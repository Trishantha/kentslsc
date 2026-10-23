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
const STRIPE_SWEEP_MAX_LOOKBACK_HOURS = RECONCILE_LOOKBACK_DAYS * 24;
const STRIPE_SWEEP_PAGE_SIZE = 100;

export interface StripeTicketSweepOptions {
  lookbackHours: number;
  onlyUpcomingEvents?: boolean;
}

export interface StripeTicketSweepResult {
  found: number;
  fulfilled: number;
  skipped: number;
  skippedReasons: Partial<Record<'alreadyFulfilled' | 'missingMetadata' | 'eventEnded' | 'refunded', number>>;
}

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
  async reconcileStripeTicketIntents(): Promise<StripeTicketSweepResult> {
    const lockKey = 'kentslsc:automation:stripe-ticket-intent-sweep';
    const lockToken = await this.acquireLock(lockKey, 55 * 60_000);
    if (!lockToken) return { found: 0, fulfilled: 0, skipped: 0, skippedReasons: {} };

    try {
      return await this.sweepStripeTicketIntents({ lookbackHours: STRIPE_SWEEP_LOOKBACK_HOURS });
    } finally {
      await this.releaseLock(lockKey, lockToken);
    }
  }

  async sweepStripeTicketIntents(options: StripeTicketSweepOptions): Promise<StripeTicketSweepResult> {
    const lookbackHours = Math.min(Math.max(options.lookbackHours, 1), STRIPE_SWEEP_MAX_LOOKBACK_HOURS);
    const onlyUpcomingEvents = options.onlyUpcomingEvents ?? false;

    let found = 0;
    let fulfilled = 0;
    let skipped = 0;
    const skippedReasons: StripeTicketSweepResult['skippedReasons'] = {};
    const skip = (reason: 'alreadyFulfilled' | 'missingMetadata' | 'eventEnded' | 'refunded') => {
      skipped++;
      skippedReasons[reason] = (skippedReasons[reason] ?? 0) + 1;
    };

    try {
      const stripe = await this.paymentsService.getStripeClient();
      const createdAfter = Math.floor(Date.now() / 1000) - lookbackHours * 60 * 60;
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
              skip('missingMetadata');
              this.logger.warn(
                `Stripe ticket intent ${paymentIntent.id} is missing eventId/userId metadata; skipping.`
              );
              continue;
            }

            if (await this.intentAlreadyFulfilled(paymentIntent.id)) {
              skip('alreadyFulfilled');
              continue;
            }

            // Search results do not expand the charge, which carries the payer
            // details handleCheckoutCompleted records on the tickets.
            const intent = await stripe.paymentIntents.retrieve(paymentIntent.id, {
              expand: ['latest_charge']
            });

            const charge = typeof intent.latest_charge === 'string' ? null : intent.latest_charge;
            if (charge?.refunded || (charge?.amount_refunded ?? 0) > 0) {
              skip('refunded');
              this.logger.warn(
                `Stripe ticket intent ${paymentIntent.id} was refunded; skipping.`
              );
              continue;
            }

            if (onlyUpcomingEvents) {
              const event = await this.prisma.event.findUnique({
                where: { id: metadata.eventId },
                select: { endDatetime: true, deletedAt: true }
              });
              if (!event || event.deletedAt || event.endDatetime.getTime() < Date.now()) {
                skip('eventEnded');
                continue;
              }
            }

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
    }

    this.logger.log(`Stripe ticket intent sweep: found ${found}, fulfilled ${fulfilled}, skipped ${skipped}`);
    return { found, fulfilled, skipped, skippedReasons };
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
