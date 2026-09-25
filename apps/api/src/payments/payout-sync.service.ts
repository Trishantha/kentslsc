import { BadRequestException, Inject, Injectable, Logger, Optional } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import Stripe from 'stripe';
import crypto from 'crypto';
import type Redis from 'ioredis';
import { PrismaService } from '../core/prisma/prisma.service.js';
import { PaymentsService } from './payments.service.js';
import { REDIS_CONNECTION } from '../queue/queue.constants.js';

const SYNC_LOOKBACK_DAYS = 90;
const SYNC_BATCH_SIZE = 100;

export interface PayoutSyncResult {
  payoutsUpserted: number;
  transactionsUpserted: number;
  errors: string[];
}

/**
 * Pulls Stripe payouts and balance transactions into local snapshot tables so
 * finance can reconcile Stripe settlement against the internal Payment ledger.
 * Every row is upserted on its unique Stripe id, so re-running a sync is safe.
 */
@Injectable()
export class PayoutSyncService {
  private readonly logger = new Logger(PayoutSyncService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly paymentsService: PaymentsService,
    @Inject(REDIS_CONNECTION) @Optional() private readonly redis?: Redis
  ) {}

  @Cron(CronExpression.EVERY_DAY_AT_6AM)
  async syncPayoutsDaily(): Promise<void> {
    const lockKey = 'kentslsc:automation:payout-sync';
    const lockToken = await this.acquireLock(lockKey, 55 * 60_000);
    if (!lockToken) return;

    try {
      await this.syncPayouts();
    } catch (err) {
      // Stripe not being configured is expected outside production; skip silently.
      if (err instanceof BadRequestException) return;
      this.logger.warn(`Scheduled payout sync failed: ${(err as Error).message}`);
    } finally {
      await this.releaseLock(lockKey, lockToken);
    }
  }

  /**
   * Sync payouts and their balance transactions for the given window
   * (default: the last 90 days), then any recent balance movements not yet
   * attached to a payout. Idempotent — safe to run manually and on a schedule.
   */
  async syncPayouts(dateRange?: { from?: Date }): Promise<PayoutSyncResult> {
    const stripe = await this.getStripe();
    const from = this.resolveFromDate(dateRange?.from);
    const result: PayoutSyncResult = { payoutsUpserted: 0, transactionsUpserted: 0, errors: [] };

    let hasMore = true;
    let startingAfter: string | undefined;

    while (hasMore) {
      const page = await stripe.payouts.list({
        limit: SYNC_BATCH_SIZE,
        created: { gte: Math.floor(from.getTime() / 1000) },
        ...(startingAfter && { starting_after: startingAfter })
      });

      for (const payout of page.data) {
        try {
          await this.upsertPayout(payout);
          result.payoutsUpserted++;
          result.transactionsUpserted += await this.syncPayoutTransactions(stripe, payout.id);
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          this.logger.warn(`Payout sync failed for ${payout.id}: ${message}`);
          result.errors.push(`payout ${payout.id}: ${message}`);
        }
      }

      hasMore = page.has_more && page.data.length > 0;
      startingAfter = hasMore ? page.data[page.data.length - 1]!.id : undefined;
    }

    result.transactionsUpserted += await this.syncBalanceTransactions({ from });

    return result;
  }

  async syncBalanceTransactions(dateRange?: { from?: Date }): Promise<number> {
    const stripe = await this.getStripe();
    const from = this.resolveFromDate(dateRange?.from);
    let upserted = 0;

    let hasMore = true;
    let startingAfter: string | undefined;

    while (hasMore) {
      const page = await stripe.balanceTransactions.list({
        limit: SYNC_BATCH_SIZE,
        created: { gte: Math.floor(from.getTime() / 1000) },
        expand: ['data.source'],
        ...(startingAfter && { starting_after: startingAfter })
      });

      for (const txn of page.data) {
        await this.upsertBalanceTransaction(txn);
        upserted++;
      }

      hasMore = page.has_more && page.data.length > 0;
      startingAfter = hasMore ? page.data[page.data.length - 1]!.id : undefined;
    }

    return upserted;
  }

  private async getStripe(): Promise<Stripe> {
    try {
      return await this.paymentsService.getStripeClient();
    } catch {
      throw new BadRequestException(
        'Stripe is not configured. Set STRIPE_SECRET_KEY to enable payments.'
      );
    }
  }

  private resolveFromDate(from?: Date): Date {
    const now = new Date();
    const maxLookback = new Date(now);
    maxLookback.setDate(maxLookback.getDate() - SYNC_LOOKBACK_DAYS);

    if (!from) return maxLookback;
    const resolved = new Date(from);
    return resolved < maxLookback ? maxLookback : resolved;
  }

  private async upsertPayout(payout: Stripe.Payout) {
    await this.prisma.stripePayout.upsert({
      where: { payoutId: payout.id },
      create: {
        payoutId: payout.id,
        amount: payout.amount / 100,
        currency: payout.currency,
        status: payout.status,
        arrivalDate: new Date(payout.arrival_date * 1000),
        method: payout.method,
        type: payout.type,
        description: payout.description,
        raw: payout as unknown as object
      },
      update: {
        amount: payout.amount / 100,
        currency: payout.currency,
        status: payout.status,
        arrivalDate: new Date(payout.arrival_date * 1000),
        method: payout.method,
        type: payout.type,
        description: payout.description,
        raw: payout as unknown as object
      }
    });
  }

  private async syncPayoutTransactions(stripe: Stripe, payoutId: string): Promise<number> {
    let upserted = 0;
    let hasMore = true;
    let startingAfter: string | undefined;

    while (hasMore) {
      const page = await stripe.balanceTransactions.list({
        payout: payoutId,
        limit: SYNC_BATCH_SIZE,
        expand: ['data.source'],
        ...(startingAfter && { starting_after: startingAfter })
      });

      for (const txn of page.data) {
        await this.upsertBalanceTransaction(txn, payoutId);
        upserted++;
      }

      hasMore = page.has_more && page.data.length > 0;
      startingAfter = hasMore ? page.data[page.data.length - 1]!.id : undefined;
    }

    return upserted;
  }

  private async upsertBalanceTransaction(txn: Stripe.BalanceTransaction, payoutId?: string) {
    const source = txn.source;
    const sourceId = typeof source === 'string' ? source : (source?.id ?? null);
    const sourcePaymentIntentId =
      source && typeof source === 'object' && 'object' in source && source.object === 'charge'
        ? typeof source.payment_intent === 'string'
          ? source.payment_intent
          : (source.payment_intent?.id ?? null)
        : null;

    await this.prisma.stripeBalanceTransaction.upsert({
      where: { transactionId: txn.id },
      create: {
        transactionId: txn.id,
        type: txn.type,
        amount: txn.amount / 100,
        fee: txn.fee / 100,
        net: txn.net / 100,
        currency: txn.currency,
        availableOn: new Date(txn.available_on * 1000),
        created: new Date(txn.created * 1000),
        description: txn.description,
        payoutId: payoutId ?? null,
        sourceId,
        sourcePaymentIntentId,
        raw: txn as unknown as object
      },
      update: {
        type: txn.type,
        amount: txn.amount / 100,
        fee: txn.fee / 100,
        net: txn.net / 100,
        currency: txn.currency,
        availableOn: new Date(txn.available_on * 1000),
        created: new Date(txn.created * 1000),
        description: txn.description,
        // Balance transactions fetched without a payout filter do not expose
        // their payout; keep any linkage already stored instead of clearing it.
        ...(payoutId ? { payoutId } : {}),
        sourceId,
        sourcePaymentIntentId,
        raw: txn as unknown as object
      }
    });
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
