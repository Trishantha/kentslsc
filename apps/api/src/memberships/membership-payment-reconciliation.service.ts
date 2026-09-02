import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { MembershipStatus } from '@kentslsc/database';
import type Stripe from 'stripe';
import { PrismaService } from '../core/prisma/prisma.service.js';
import { PaymentsService } from '../payments/payments.service.js';
import { MembershipsService } from './memberships.service.js';

const RECONCILE_LOOKBACK_DAYS = 60;
const RECONCILE_BATCH_SIZE = 100;

/**
 * Safety net for memberships that were paid on Stripe but never activated
 * locally, for example when the webhook was dropped, the queue worker was down
 * or the member closed the browser before the confirmation call completed.
 *
 * The job asks Stripe for the subscriptions of every membership still awaiting
 * payment and activates the ones Stripe reports as paid.
 */
@Injectable()
export class MembershipPaymentReconciliationService {
  private readonly logger = new Logger(MembershipPaymentReconciliationService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly paymentsService: PaymentsService,
    private readonly membershipsService: MembershipsService
  ) {}

  @Cron(CronExpression.EVERY_HOUR)
  async reconcilePendingPayments(): Promise<{ checked: number; activated: number }> {
    const since = new Date();
    since.setDate(since.getDate() - RECONCILE_LOOKBACK_DAYS);

    const where = {
      deletedAt: null,
      status: MembershipStatus.AWAITING_PAYMENT,
      paidAt: null,
      stripeCustomerId: { not: null },
      updatedAt: { gte: since }
    } as const;
    let cursor: string | undefined;
    let checked = 0;
    let activated = 0;

    while (true) {
      const candidates = await this.prisma.membership.findMany({
        where,
        orderBy: { id: 'asc' },
        ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
        select: { id: true, membershipId: true, stripeCustomerId: true, stripePriceId: true },
        take: RECONCILE_BATCH_SIZE
      });
      if (candidates.length === 0) break;
      cursor = candidates[candidates.length - 1]?.id;
      checked += candidates.length;

      for (const candidate of candidates) {
        if (!candidate.stripeCustomerId) continue;

        try {
          const subscriptions = await this.paymentsService.listCustomerSubscriptions(
            candidate.stripeCustomerId
          );
          const paid = this.findPaidSubscription(subscriptions, candidate.stripePriceId);
          if (!paid) continue;

          const result = await this.membershipsService.applyPaidSubscription(candidate.id, paid);
          if (result.activated) activated++;
        } catch (err) {
          this.logger.warn(
            `Could not reconcile membership ${candidate.membershipId}: ${(err as Error).message}`
          );
        }
      }
      if (candidates.length < RECONCILE_BATCH_SIZE) break;
    }

    if (activated > 0) {
      this.logger.log(`Reconciled ${activated} paid membership(s) from Stripe`);
    }

    return { checked, activated };
  }

  private findPaidSubscription(
    subscriptions: Stripe.Subscription[],
    expectedPriceId: string | null
  ): Stripe.Subscription | null {
    const paid = subscriptions.filter(
      (subscription) => subscription.status === 'active' || subscription.status === 'trialing'
    );
    if (paid.length === 0) return null;

    if (expectedPriceId) {
      const matching = paid.find((subscription) =>
        subscription.items.data.some((item) => item.price?.id === expectedPriceId)
      );
      if (matching) return matching;
      return null;
    }

    return paid[0] ?? null;
  }
}
