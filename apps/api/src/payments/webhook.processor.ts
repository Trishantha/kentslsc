import { Injectable, Logger } from '@nestjs/common';
import type Stripe from 'stripe';
import { PaymentsService } from './payments.service.js';
import { EventsService } from '../events/events.service.js';
import { MembershipsService } from '../memberships/memberships.service.js';
import { FundraisingService } from '../fundraising/fundraising.service.js';
import { DirectoryService } from '../directory/directory.service.js';
import { WebhookEventService } from './webhook-event.service.js';
import type { WebhookJobData } from '../queue/queue.types.js';

@Injectable()
export class WebhookProcessor {
  private readonly logger = new Logger(WebhookProcessor.name);

  constructor(
    private readonly paymentsService: PaymentsService,
    private readonly eventsService: EventsService,
    private readonly membershipsService: MembershipsService,
    private readonly fundraisingService: FundraisingService,
    private readonly directoryService: DirectoryService,
    private readonly webhookEvents: WebhookEventService
  ) {}

  async process(data: WebhookJobData): Promise<void> {
    try {
      if (data.provider === 'stripe') {
        await this.processStripeEvent(data);
      }

      await this.webhookEvents.markStatus(data.ledgerId, 'processed');
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.error(`Webhook ${data.provider} ${data.eventType} processing failed: ${message}`);
      await this.webhookEvents.markStatus(data.ledgerId, 'failed', message);
      throw err;
    }
  }

  private async processStripeEvent(data: WebhookJobData): Promise<void> {
    const event = data.payload as Stripe.Event;

    if (event.type === 'checkout.session.completed') {
      const session = event.data.object as Stripe.Checkout.Session;
      const metadata = session.metadata ?? {};

      if (metadata.source === 'membership') {
        await this.membershipsService.handleCheckoutSessionCompleted(session);
      } else if (metadata.type === 'event_ticket') {
        await this.eventsService.handleCheckoutCompleted(session);
      } else if (metadata.type === 'donation') {
        await this.fundraisingService.handleCheckoutCompleted(session);
      } else if (metadata.type === 'directory_promotion') {
        await this.directoryService.handlePromotionCompleted(metadata, 'stripe', {
          providerCheckoutId: session.id,
          providerPaymentId:
            typeof session.payment_intent === 'string'
              ? session.payment_intent
              : session.payment_intent?.id ?? null,
          amountPence: session.amount_total ?? undefined,
          currency: session.currency ?? 'gbp',
          payerEmail: session.customer_email ?? session.customer_details?.email ?? null,
          payerName: session.customer_details?.name ?? null,
          payerPhone: session.customer_details?.phone ?? null,
          purchasedAt: session.created ? new Date(session.created * 1000) : new Date()
        });
      } else if (metadata.type === 'job_publish') {
        await this.directoryService.handleJobPublishCompleted(metadata, {
          providerCheckoutId: session.id,
          providerPaymentId:
            typeof session.payment_intent === 'string'
              ? session.payment_intent
              : session.payment_intent?.id ?? null,
          amountPence: session.amount_total ?? undefined,
          currency: session.currency ?? 'gbp',
          payerEmail: session.customer_email ?? session.customer_details?.email ?? null,
          payerName: session.customer_details?.name ?? null,
          payerPhone: session.customer_details?.phone ?? null,
          purchasedAt: session.created ? new Date(session.created * 1000) : new Date()
        });
      }

      // Overwrite the estimated processing fee with Stripe's actual fee and net
      // settlement so the revenue report matches Stripe's payout reporting.
      await this.paymentsService.syncStripeFeesFromSession(session);
    } else if (event.type === 'customer.subscription.updated') {
      await this.membershipsService.handleSubscriptionUpdated(event.data.object as Stripe.Subscription);
    } else if (event.type === 'customer.subscription.deleted') {
      await this.membershipsService.handleSubscriptionDeleted(event.data.object as Stripe.Subscription);
    }
  }
}
