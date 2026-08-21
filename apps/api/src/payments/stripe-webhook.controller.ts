import { Controller, Logger, Post, Headers, RawBody, Res } from '@nestjs/common';
import type { Response } from 'express';
import type Stripe from 'stripe';
import { Public } from '../common/decorators/public.decorator.js';
import { PaymentsService } from './payments.service.js';
import { EventsService } from '../events/events.service.js';
import { MembershipsService } from '../memberships/memberships.service.js';
import { FundraisingService } from '../fundraising/fundraising.service.js';
import { DirectoryService } from '../directory/directory.service.js';
import { WebhookEventService } from './webhook-event.service.js';

/**
 * Single production Stripe webhook endpoint.
 *
 * Stripe can only be configured with one webhook URL per signing secret. The
 * app creates Checkout Sessions for memberships, events, donations and directory
 * promotions, each of which used to have its own controller webhook route.
 * This controller receives all Stripe events on one route and dispatches to
 * the correct domain handler based on the Checkout Session metadata.
 */
@Controller('payments')
export class StripeWebhookController {
  private readonly logger = new Logger(StripeWebhookController.name);

  constructor(
    private readonly paymentsService: PaymentsService,
    private readonly eventsService: EventsService,
    private readonly membershipsService: MembershipsService,
    private readonly fundraisingService: FundraisingService,
    private readonly directoryService: DirectoryService,
    private readonly webhookEvents: WebhookEventService
  ) {}

  @Post('webhook')
  @Public()
  async handleWebhook(
    @Headers('stripe-signature') signature: string,
    @RawBody() rawBody: Buffer,
    @Res() res: Response
  ) {
    let event: Stripe.Event | undefined;

    try {
      event = await this.paymentsService.constructEvent(rawBody, signature);
    } catch (err) {
      this.logger.warn(`Stripe webhook signature verification failed: ${(err as Error).message}`);
      return res.status(400).send(`Webhook error: ${(err as Error).message}`);
    }

    const { event: ledgerEvent, isDuplicate } = await this.webhookEvents.record({
      provider: 'stripe',
      eventType: event.type,
      externalId: event.id,
      payload: rawBody,
      status: 'received'
    });

    if (isDuplicate) {
      this.logger.debug(`Duplicate Stripe event ${event.id} ignored.`);
      return res.json({ received: true, duplicate: true });
    }

    try {
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

      await this.webhookEvents.markStatus(ledgerEvent.id, 'processed');
      return res.json({ received: true });
    } catch (err) {
      const message = (err as Error).message;
      this.logger.error(`Stripe webhook ${event.id} processing failed: ${message}`);
      await this.webhookEvents.markStatus(ledgerEvent.id, 'failed', message);
      return res.status(400).send(`Webhook error: ${message}`);
    }
  }
}
