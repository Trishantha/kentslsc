import { Inject, Injectable, Logger, Optional } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PaymentSourceType, PaymentStatus } from '@kentslsc/database';
import crypto from 'crypto';
import type Redis from 'ioredis';
import { PrismaService } from '../core/prisma/prisma.service.js';
import { EventsService } from './events.service.js';
import { REDIS_CONNECTION } from '../queue/queue.constants.js';

const RECONCILE_LOOKBACK_DAYS = 90;
const RECONCILE_BATCH_SIZE = 100;

/**
 * Safety net for ticket payments that were captured but never fulfilled, for
 * example when the provider webhook was dropped, the queue worker was down, or
 * the payer closed the browser before the confirmation call completed.
 *
 * The job scans recent completed ticket payments and issues the tickets for
 * any that have none. Issuance is idempotent (guarded by payment id and
 * provider checkout id), so replaying is safe.
 */
@Injectable()
export class TicketPaymentReconciliationService {
  private readonly logger = new Logger(TicketPaymentReconciliationService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly eventsService: EventsService,
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
