import { Injectable, Logger } from '@nestjs/common';
import type Stripe from 'stripe';
import { PaymentsService } from './payments.service.js';
import { GoCardlessService, unpackBillingRequestMetadata } from './gocardless.service.js';
import { EventsService } from '../events/events.service.js';
import { MembershipsService } from '../memberships/memberships.service.js';
import { FundraisingService } from '../fundraising/fundraising.service.js';
import { DirectoryService } from '../directory/directory.service.js';
import { WebhookEventService } from './webhook-event.service.js';
import type { WebhookJobData } from '../queue/queue.types.js';
import type {
  GoCardlessInstalmentScheduleResource,
  GoCardlessMandateResource,
  GoCardlessPaymentResource,
  GoCardlessRefundResource,
  GoCardlessWebhookEvent
} from './gocardless-webhook.types.js';

@Injectable()
export class WebhookProcessor {
  private readonly logger = new Logger(WebhookProcessor.name);

  constructor(
    private readonly paymentsService: PaymentsService,
    private readonly eventsService: EventsService,
    private readonly membershipsService: MembershipsService,
    private readonly fundraisingService: FundraisingService,
    private readonly directoryService: DirectoryService,
    private readonly webhookEvents: WebhookEventService,
    private readonly goCardlessService: GoCardlessService
  ) {}

  async process(data: WebhookJobData): Promise<void> {
    try {
      if (data.provider === 'stripe') {
        await this.processStripeEvent(data);
        await this.webhookEvents.markStatus(data.ledgerId, 'processed');
      } else if (data.provider === 'gocardless') {
        const status = await this.processGoCardlessEvent(data);
        await this.webhookEvents.markStatus(data.ledgerId, status);
      }
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
    } else if (event.type === 'invoice.paid') {
      await this.membershipsService.handleInvoicePaid(event.data.object as Stripe.Invoice);
    }
  }

  /**
   * Process a single GoCardless webhook event (the per-event object from the
   * batch, as recorded in the ledger). Fulfilment only happens on
   * `payments.confirmed`, where funds are guaranteed; `payments.paid_out` is
   * a settlement event and is a no-op for fulfilment.
   */
  private async processGoCardlessEvent(data: WebhookJobData): Promise<'processed' | 'ignored'> {
    const event = data.payload as unknown as GoCardlessWebhookEvent;
    const key = `${event.resource_type}.${event.action}`;

    switch (key) {
      case 'payments.confirmed':
      case 'payments.paid_out': {
        const payment = await this.resolveGoCardlessPayment(event);
        if (!payment?.id) {
          this.logger.warn(`GoCardless event ${event.id} has no payment reference; ignoring.`);
          return 'ignored';
        }

        // Settlement only: the payment was already fulfilled at `confirmed`.
        if (key === 'payments.paid_out') {
          return 'processed';
        }

        const metadata = await this.resolveGoCardlessMetadata(payment);
        if (metadata.source === 'membership') {
          await this.membershipsService.handleGoCardlessPaymentCompleted(payment, metadata);
        } else if (metadata.type === 'event_ticket') {
          await this.eventsService.handleGoCardlessPaymentCompleted(payment, metadata);
        } else if (metadata.type === 'donation') {
          await this.fundraisingService.handleGoCardlessPaymentCompleted(payment, metadata);
        } else if (metadata.type === 'directory_promotion') {
          await this.directoryService.handleGoCardlessPaymentCompleted(payment, metadata, 'directory_promotion');
        } else if (metadata.type === 'job_publish') {
          await this.directoryService.handleGoCardlessPaymentCompleted(payment, metadata, 'job_publish');
        } else {
          this.logger.debug(`GoCardless payment ${payment.id} has no fulfilment metadata; ignoring.`);
          return 'ignored';
        }
        return 'processed';
      }

      case 'payments.failed':
      case 'payments.cancelled': {
        const payment = await this.resolveGoCardlessPayment(event);
        if (!payment?.id) {
          return 'ignored';
        }
        await this.membershipsService.handleGoCardlessPaymentFailed(payment);
        return 'processed';
      }

      case 'mandates.active': {
        const mandate = this.mandateFromEvent(event);
        if (!mandate?.id) return 'ignored';
        await this.membershipsService.handleGoCardlessMandateActive(mandate);
        return 'processed';
      }

      case 'mandates.cancelled':
      case 'mandates.expired':
      case 'mandates.failed': {
        const mandate = this.mandateFromEvent(event);
        if (!mandate?.id) return 'ignored';
        await this.membershipsService.handleGoCardlessMandateCancelled(mandate);
        return 'processed';
      }

      case 'subscriptions.payment_created': {
        const payment = await this.resolveGoCardlessPayment(event);
        if (!payment?.id) return 'ignored';
        await this.membershipsService.handleGoCardlessSubscriptionPaymentCreated(payment);
        return 'processed';
      }

      case 'subscriptions.cancelled':
      case 'subscriptions.finished':
      case 'subscriptions.paused': {
        const subscription = event.body?.subscriptions;
        if (!subscription?.id) return 'ignored';
        await this.membershipsService.handleGoCardlessSubscriptionStatus(subscription, event.action);
        return 'processed';
      }

      case 'instalment_schedules.created': {
        const schedule = event.body?.instalment_schedules;
        if (!schedule?.id) return 'ignored';
        const metadata = await this.resolveGoCardlessScheduleMetadata(schedule);
        await this.membershipsService.handleGoCardlessInstalmentScheduleCreated(schedule, metadata);
        return 'processed';
      }

      case 'instalment_schedules.payment_created': {
        const payment = await this.resolveGoCardlessPayment(event);
        if (!payment?.id) return 'ignored';
        await this.membershipsService.handleGoCardlessInstalmentPayment(payment);
        return 'processed';
      }

      case 'instalment_schedules.finished': {
        const schedule = event.body?.instalment_schedules;
        if (!schedule?.id) return 'ignored';
        await this.membershipsService.handleGoCardlessInstalmentScheduleFinished(schedule);
        return 'processed';
      }

      case 'refunds.created': {
        const refund = event.body?.refunds as GoCardlessRefundResource | undefined;
        if (!refund) return 'ignored';
        await this.paymentsService.recordGoCardlessRefund(refund);
        return 'processed';
      }

      default:
        this.logger.debug(`Ignoring unhandled GoCardless event type ${key}.`);
        return 'ignored';
    }
  }

  /**
   * The webhook body usually contains the full resource; fall back to an API
   * lookup by the id in the event links when it does not.
   */
  private async resolveGoCardlessPayment(event: GoCardlessWebhookEvent): Promise<GoCardlessPaymentResource | null> {
    const bodyPayment = event.body?.payments;
    if (bodyPayment?.id) {
      return bodyPayment;
    }
    const paymentId = event.links?.payment ?? bodyPayment?.id;
    if (!paymentId) {
      return null;
    }
    try {
      return (await this.goCardlessService.getPayment(paymentId)) as GoCardlessPaymentResource;
    } catch (err) {
      this.logger.warn(`Could not fetch GoCardless payment ${paymentId}: ${(err as Error).message}`);
      return null;
    }
  }

  /**
   * Checkout metadata (source/type/ids) lives on the billing request, and the
   * payment body often lacks it entirely, so resolve it through the billing
   * request linked to the payment.
   */
  private async resolveGoCardlessMetadata(payment: GoCardlessPaymentResource): Promise<Record<string, string>> {
    const fromPayment = payment.metadata ?? {};
    if ((fromPayment.source || fromPayment.type) && !payment.links?.billing_request) {
      return fromPayment;
    }

    const billingRequestId = payment.links?.billing_request;
    if (!billingRequestId) {
      return fromPayment;
    }

    try {
      const billingRequest = await this.goCardlessService.getBillingRequest(billingRequestId);
      return { ...unpackBillingRequestMetadata(fromPayment), ...unpackBillingRequestMetadata(billingRequest.metadata) };
    } catch (err) {
      this.logger.warn(
        `Could not fetch GoCardless billing request ${billingRequestId}: ${(err as Error).message}`
      );
      return unpackBillingRequestMetadata(fromPayment);
    }
  }

  private async resolveGoCardlessScheduleMetadata(
    schedule: GoCardlessInstalmentScheduleResource
  ): Promise<Record<string, string>> {
    const fromSchedule = schedule.metadata ?? {};
    const billingRequestId = schedule.links?.billing_request;
    if (!billingRequestId) {
      return unpackBillingRequestMetadata(fromSchedule);
    }
    try {
      const billingRequest = await this.goCardlessService.getBillingRequest(billingRequestId);
      return { ...unpackBillingRequestMetadata(fromSchedule), ...unpackBillingRequestMetadata(billingRequest.metadata) };
    } catch (err) {
      this.logger.warn(
        `Could not fetch GoCardless billing request ${billingRequestId}: ${(err as Error).message}`
      );
      return fromSchedule;
    }
  }

  private mandateFromEvent(event: GoCardlessWebhookEvent): GoCardlessMandateResource | null {
    const bodyMandate = event.body?.mandates;
    if (bodyMandate?.id) {
      return bodyMandate;
    }
    const mandateId = event.links?.mandate ?? bodyMandate?.id;
    return mandateId ? { id: mandateId, links: { billing_request: event.links?.billing_request } } : null;
  }
}
