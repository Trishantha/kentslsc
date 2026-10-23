import { Inject, Injectable, Logger, Optional } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PaymentSourceType, PaymentStatus } from '@kentslsc/database';
import crypto from 'crypto';
import type Redis from 'ioredis';
import type Stripe from 'stripe';
import { PrismaService } from '../core/prisma/prisma.service.js';
import { EventsService } from './events.service.js';
import { PaymentsService } from '../payments/payments.service.js';
import { buildPseudoCheckoutSession } from '../payments/utils/pseudo-checkout-session.js';
import { REDIS_CONNECTION } from '../queue/queue.constants.js';

const RECONCILE_LOOKBACK_DAYS = 90;
const RECONCILE_BATCH_SIZE = 100;
const STRIPE_SWEEP_LOOKBACK_HOURS = 24;
const STRIPE_SWEEP_PAGE_SIZE = 100;

/**
 * Safety net for ticket payments that were captured but never fulfilled, for
 * example when the provider webhook was dropped, the queue worker was down, or
 * the payer closed the browser before the confirmation call completed.
 *
 * The job scans recent completed ticket payments and issues the tickets for
 * any that have none. Issuance is idempotent (guarded by payment id and
 * provider checkout id), so replaying is safe.
 *
 * A companion sweep asks Stripe directly for recently succeeded event-ticket
 * PaymentIntents, covering the case where no local Payment row exists yet
 * because the Payment Element flow only creates it during ticket fulfilment.
 */
@Injectable()
export class TicketPaymentReconciliationService {
  private readonly logger = new Logger(TicketPaymentReconciliationService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly eventsService: EventsService,
    private readonly paymentsService: PaymentsService,
    @Inject(REDIS_CONNECTION) @Optional() private readonly redis?: Redis
  ) {}

  @Cron(CronExpression.EVERY_HOUR)
  async reconcileUnfulfilledTicketPayments(): Promise<{ checked: number; issued: number }> {
    const lockKey = 'kentslsc:automation:ticket-payment-reconciliation';
    const lockToken = await this.acquireLock(lockKey, 55 * 60_000);
    if (!lockToken) return { checked: 0, issued: 0 };

    try {
      const since = new Date();
      since.setDate(since.getDate() - RECONCILE_LOOKBACK_DAYS);

      let cursor: string | undefined;
      let checked = 0;
      let issued = 0;

      while (true) {
        const candidates = await this.prisma.payment.findMany({
          where: {
            deletedAt: null,
            paymentStatus: PaymentStatus.COMPLETED,
            sourceType: PaymentSourceType.TICKET,
            createdAt: { gte: since }
          },
          orderBy: { id: 'asc' },
          ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
          take: RECONCILE_BATCH_SIZE
        });
        if (candidates.length === 0) break;
        cursor = candidates[candidates.length - 1]?.id;

        for (const payment of candidates) {
          try {
            const sessionRef = payment.providerCheckoutId;
            const ticketCount = await this.prisma.ticket.count({
              where: {
                deletedAt: null,
                OR: [
                  { paymentId: payment.id },
                  ...(sessionRef ? [{ stripeSessionId: sessionRef }] : [])
                ]
              }
            });
            checked++;
            if (ticketCount > 0) continue;

            const tickets = await this.eventsService.fulfilTicketsForPayment(payment);
            if (tickets && tickets.length > 0) {
              issued++;
              this.logger.log(
                `Issued ${tickets.length} ticket(s) for unfulfilled payment ${payment.id} (${payment.payerEmail ?? 'unknown payer'})`
              );
            }
          } catch (err) {
            this.logger.warn(
              `Could not reconcile ticket payment ${payment.id}: ${(err as Error).message}`
            );
          }
        }
        if (candidates.length < RECONCILE_BATCH_SIZE) break;
      }

      return { checked, issued };
    } finally {
      await this.releaseLock(lockKey, lockToken);
    }
  }

  @Cron(CronExpression.EVERY_HOUR)
  async reconcileStripeTicketIntents(): Promise<{ found: number; fulfilled: number; skipped: number }> {
    const lockKey = 'kentslsc:automation:stripe-ticket-intent-sweep';
    const lockToken = await this.acquireLock(lockKey, 55 * 60_000);
    if (!lockToken) return { found: 0, fulfilled: 0, skipped: 0 };

    let found = 0;
    let fulfilled = 0;
    let skipped = 0;

    try {
      const stripe = await this.paymentsService.getStripeClient();
      const createdAfter = Math.floor(Date.now() / 1000) - STRIPE_SWEEP_LOOKBACK_HOURS * 60 * 60;
      let nextPage: string | undefined;

      while (true) {
        const result: Stripe.ApiSearchResult<Stripe.PaymentIntent> = await stripe.paymentIntents.search({
          query: `metadata['type']:'event_ticket' AND status:'succeeded' AND created>${createdAfter}`,
          limit: STRIPE_SWEEP_PAGE_SIZE,
          ...(nextPage ? { page: nextPage } : {})
        });
        if (result.data.length === 0) break;

        for (const paymentIntent of result.data) {
          found++;
          try {
            const metadata = paymentIntent.metadata ?? {};
            if (!metadata.eventId || !metadata.userId) {
              skipped++;
              this.logger.warn(
                `Stripe ticket intent ${paymentIntent.id} is missing eventId/userId metadata; skipping.`
              );
              continue;
            }

            if (await this.intentAlreadyFulfilled(paymentIntent.id)) {
              skipped++;
              continue;
            }

            // Search results do not expand the charge, which carries the payer
            // details handleCheckoutCompleted records on the tickets.
            const intent = await stripe.paymentIntents.retrieve(paymentIntent.id, {
              expand: ['latest_charge']
            });
            const tickets = await this.eventsService.handleCheckoutCompleted(
              buildPseudoCheckoutSession(intent)
            );
            if (tickets && tickets.length > 0) {
              fulfilled++;
              this.logger.log(
                `Fulfilled ${tickets.length} ticket(s) for Stripe intent ${paymentIntent.id} missed by webhooks`
              );
            }
          } catch (err) {
            this.logger.warn(
              `Could not reconcile Stripe ticket intent ${paymentIntent.id}: ${(err as Error).message}`
            );
          }
        }

        nextPage = result.next_page ?? undefined;
        if (!nextPage) break;
      }
    } catch (err) {
      this.logger.warn(`Stripe ticket intent sweep failed: ${(err as Error).message}`);
    } finally {
      await this.releaseLock(lockKey, lockToken);
    }

    this.logger.log(`Stripe ticket intent sweep: found ${found}, fulfilled ${fulfilled}, skipped ${skipped}`);
    return { found, fulfilled, skipped };
  }

  private async intentAlreadyFulfilled(intentId: string): Promise<boolean> {
    const [ticketCount, paymentCount] = await Promise.all([
      this.prisma.ticket.count({ where: { deletedAt: null, stripeSessionId: intentId } }),
      this.prisma.payment.count({
        where: {
          deletedAt: null,
          OR: [{ providerCheckoutId: intentId }, { providerPaymentId: intentId }]
        }
      })
    ]);
    return ticketCount > 0 || paymentCount > 0;
  }

  private async acquireLock(key: string, ttl: number): Promise<string | null> {
    if (!this.redis) return crypto.randomUUID();
    const token = crypto.randomUUID();
    return (await this.redis.set(key, token, 'PX', ttl, 'NX')) === 'OK' ? token : null;
  }

  private async releaseLock(key: string, token: string): Promise<void> {
    if (!this.redis) return;
    await this.redis.eval(
      "if redis.call('get', KEYS[1]) == ARGV[1] then return redis.call('del', KEYS[1]) else return 0 end",
      1,
      key,
      token
    );
  }
}
