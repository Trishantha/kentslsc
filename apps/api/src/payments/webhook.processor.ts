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

  async process(data: WebhookJobData): Promise<unknown> {
    try {
      if (data.provider === 'stripe') {
        const fulfilled = await this.processStripeEvent(data);
        await this.webhookEvents.markStatus(data.ledgerId, 'processed');
        return fulfilled;
      } else if (data.provider === 'gocardless') {
        const status = await this.processGoCardlessEvent(data);
        await this.webhookEvents.markStatus(data.ledgerId, status);
        return status;
      }
      return undefined;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.error(`Webhook ${data.provider} ${data.eventType} processing failed: ${message}`);
      await this.webhookEvents.markStatus(data.ledgerId, 'failed', message);
      throw err;
    }
  }

  private async processStripeEvent(data: WebhookJobData): Promise<boolean> {
    const event = data.payload as Stripe.Event;

    if (event.type === 'checkout.session.completed') {
      const session = event.data.object as Stripe.Checkout.Session;
      const fulfilled = await this.fulfilCheckoutSession(session);

      // Overwrite the estimated processing fee with Stripe's actual fee and net
      // settlement so the revenue report matches Stripe's payout reporting.
      await this.paymentsService.syncStripeFeesFromSession(session);
      return fulfilled;
    } else if (event.type === 'payment_intent.succeeded') {
      // Embedded checkouts (custom Payment Element) settle PaymentIntents
      // directly instead of going through a Checkout Session.
      const paymentIntent = event.data.object as Stripe.PaymentIntent;
      const session = await this.buildPseudoSessionFromPaymentIntent(paymentIntent.id);
      if (!session) return false;
      const fulfilled = await this.fulfilCheckoutSession(session);
      await this.paymentsService.syncStripeFeesFromSession(session);
      return fulfilled;
    } else if (event.type === 'payment_intent.payment_failed') {
      const paymentIntent = event.data.object as Stripe.PaymentIntent;
      this.logger.warn(`PaymentIntent ${paymentIntent.id} failed: ${paymentIntent.last_payment_error?.message ?? 'unknown error'}`);
      return true;
    } else if (event.type === 'customer.subscription.updated') {
      await this.membershipsService.handleSubscriptionUpdated(event.data.object as Stripe.Subscription);
    } else if (event.type === 'customer.subscription.deleted') {
      await this.membershipsService.handleSubscriptionDeleted(event.data.object as Stripe.Subscription);
    } else if (event.type === 'invoice.paid') {
      await this.membershipsService.handleInvoicePaid(event.data.object as Stripe.Invoice);
    }
    return false;
  }

  /**
   * Route a completed checkout (or PaymentIntent-backed pseudo-checkout) to the
   * domain fulfilment handler based on its metadata.
   */
  private async fulfilCheckoutSession(session: Stripe.Checkout.Session): Promise<boolean> {
    const metadata = session.metadata ?? {};
    let fulfilled = false;

    if (metadata.source === 'membership') {
      await this.membershipsService.handleCheckoutSessionCompleted(session);
      fulfilled = true;
    } else if (metadata.type === 'event_ticket') {
      await this.eventsService.handleCheckoutCompleted(session);
      fulfilled = true;
    } else if (metadata.type === 'donation') {
      await this.fundraisingService.handleCheckoutCompleted(session);
      fulfilled = true;
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

    return fulfilled;
  }

  /**
   * Map a succeeded PaymentIntent onto a Checkout-Session-shaped object so the
   * existing domain fulfilment handlers (which key off session metadata and
   * ids) work unchanged for Payment Element checkouts. The PaymentIntent is
   * re-retrieved with its charge expanded because webhook payloads do not
   * include billing details. Returns null unless the intent has succeeded.
   */
  async buildPseudoSessionFromPaymentIntent(
    paymentIntentId: string
  ): Promise<Stripe.Checkout.Session | null> {
    const paymentIntent = await this.paymentsService
      .getClient()
      .paymentIntents.retrieve(paymentIntentId, { expand: ['latest_charge'] });

    if (paymentIntent.status !== 'succeeded') return null;

    const charge =
      typeof paymentIntent.latest_charge === 'string'
        ? null
        : paymentIntent.latest_charge;

    return {
      id: paymentIntent.id,
      object: 'checkout.session',
      metadata: paymentIntent.metadata ?? {},
      status: 'complete',
      payment_status: 'paid',
      amount_total: paymentIntent.amount,
      amount_subtotal: paymentIntent.amount,
      currency: paymentIntent.currency,
      payment_intent: paymentIntent.id,
      customer_email: charge?.billing_details?.email ?? paymentIntent.receipt_email,
      customer_details: {
        email: charge?.billing_details?.email ?? paymentIntent.receipt_email ?? null,
        name: charge?.billing_details?.name ?? null,
        phone: charge?.billing_details?.phone ?? null,
        address: null,
        tax_exempt: 'none'
      },
      created: paymentIntent.created
    } as Stripe.Checkout.Session;
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

        const metadata = await this.resolveGoCardlessMetadata(payment);

        if (key === 'payments.paid_out') {
          // Settlement only for most flows — but if the matching payments.confirmed
          // was missed, a donation would otherwise never be recorded. Fulfilment is
          // idempotent, so this only recovers donations that slipped through.
          if (metadata.type === 'donation') {
            await this.fundraisingService.handleGoCardlessPaymentCompleted(payment, metadata);
          }
          return 'processed';
        }

        if (
          metadata.source === 'membership' ||
          payment.links?.subscription ||
          payment.links?.instalment_schedule
        ) {
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
          this.logger.warn(`GoCardless payment ${payment.id} has no fulfilment metadata; ignoring.`);
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
        // This event only means GoCardless has scheduled a collection. Access
        // must wait for the corresponding payments.confirmed event.
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
        // This event only means GoCardless has scheduled a collection. Access
        // must wait for the corresponding payments.confirmed event.
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

    let merged: Record<string, string>;
    try {
      const billingRequest = await this.goCardlessService.getBillingRequest(billingRequestId);
      merged = { ...unpackBillingRequestMetadata(fromPayment), ...unpackBillingRequestMetadata(billingRequest.metadata) };
    } catch (err) {
      this.logger.warn(
        `Could not fetch GoCardless billing request ${billingRequestId}: ${(err as Error).message}`
      );
      merged = unpackBillingRequestMetadata(fromPayment);
    }

    // The billing request metadata (and even the payment's own) can be empty
    // when the API is unreachable or the environment mismatches. The pending
    // Payment row recorded at checkout carries the same metadata locally.
    if (!merged.type && !merged.source) {
      const pending = await this.paymentsService.getPaymentByProviderCheckoutId(billingRequestId);
      const local = pending?.metadata as Record<string, string> | null | undefined;
      if (local) {
        merged = { ...merged, ...local };
      }
    }

    return merged;
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
