import { Controller, Logger, Post, Headers, RawBody, Res, Body, BadRequestException } from '@nestjs/common';
import { ApiBearerAuth } from '@nestjs/swagger';
import type { Response } from 'express';
import type Stripe from 'stripe';
import { Public } from '../common/decorators/public.decorator.js';
import { OptionalAuthRoute } from '../common/decorators/optional-auth-route.decorator.js';
import { PaymentsService } from './payments.service.js';
import { unpackBillingRequestMetadata } from './gocardless.service.js';
import { GoCardlessService } from './gocardless.service.js';
import { WebhookEventService } from './webhook-event.service.js';
import { WebhookQueueService } from './webhook-queue.service.js';
import { WebhookProcessor } from './webhook.processor.js';
import type { WebhookJobData } from '../queue/queue.types.js';
import type { GoCardlessPaymentResource } from './gocardless-webhook.types.js';

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
    private readonly webhookEvents: WebhookEventService,
    private readonly webhookQueue: WebhookQueueService,
    private readonly webhookProcessor: WebhookProcessor,
    private readonly goCardlessService?: GoCardlessService
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
      // Offload the actual event processing to a queue worker so Stripe gets an
      // immediate 200 response and retries are handled by BullMQ instead of
      // forcing Stripe to resend the webhook.
      await this.webhookQueue.addWebhookJob({
        ledgerId: ledgerEvent.id,
        provider: 'stripe',
        eventType: event.type,
        payload: event
      });

      return res.json({ received: true });
    } catch (err) {
      const message = (err as Error).message;
      this.logger.error(`Stripe webhook ${event.id} enqueue failed: ${message}`);
      await this.webhookEvents.markStatus(ledgerEvent.id, 'failed', message);
      return res.status(500).send(`Webhook error: ${message}`);
    }
  }

  /**
   * Explicit success confirmation for any Stripe/PayPal/GoCardless checkout.
   *
   * The frontend calls this when the payer returns from the gateway. It
   * protects against webhooks that are delayed, misconfigured, or dropped:
   * we ask the gateway for the checkout status and run the same handlers
   * that the webhook worker would run. All handlers are idempotent, so
   * calling this after a successful webhook is safe.
   *
   * For GoCardless, `sessionId` is the Billing Request id (BR...): the flow
   * only completes once the billing request is fulfilled, and the synthetic
   * `payments.confirmed` event built here is routed by the billing request
   * metadata exactly like a real webhook.
   */
  @Post('confirm-session')
  @Public()
  @OptionalAuthRoute()
  @ApiBearerAuth()
  async confirmSession(@Body() body: { sessionId: string; provider: 'stripe' | 'paypal' | 'gocardless' }) {
    const { sessionId, provider } = body;

    if (!sessionId || !provider) {
      throw new BadRequestException('sessionId and provider are required');
    }

    if (provider === 'paypal') {
      throw new BadRequestException('PayPal confirmation is not yet supported');
    }

    if (provider === 'gocardless') {
      return this.confirmGoCardlessSession(sessionId);
    }

    const session = await this.paymentsService.getFullCheckoutSession(sessionId);

    if (session.status !== 'complete' || session.payment_status !== 'paid') {
      throw new BadRequestException(
        `Checkout session is not complete (status: ${session.status}, payment_status: ${session.payment_status})`
      );
    }

    // Record a synthetic webhook event so the processor can update its ledger.
    const externalId = `confirm:${sessionId}`;
    const recordResult = await this.webhookEvents.record({
      provider: 'stripe',
      eventType: 'checkout.session.completed',
      externalId,
      payload: Buffer.from(JSON.stringify(session)),
      status: 'received'
    });

    // Only skip reprocessing when a previous confirmation actually succeeded.
    // A ledger row left in `received` or `failed` means the payment was never
    // applied, so the membership would stay "unpaid" forever if we bailed out
    // here. All handlers are idempotent, so replaying is safe.
    if (recordResult.isDuplicate && recordResult.event.status === 'processed') {
      return { received: true, duplicate: true };
    }

    const syntheticEvent = {
      id: externalId,
      type: 'checkout.session.completed',
      data: { object: session }
    } as unknown as Stripe.Event;

    const job: WebhookJobData = {
      ledgerId: recordResult.event.id,
      provider: 'stripe',
      eventType: 'checkout.session.completed',
      payload: syntheticEvent
    };

    const fulfilled = await this.webhookProcessor.process(job);

    // The frontend only calls this route from a checkout success redirect, so
    // a session with no fulfilment metadata means the payment was never
    // applied. Leave the ledger 'ignored' (not 'processed') so a later retry
    // re-runs, and log what Stripe actually returned.
    if (fulfilled !== true) {
      this.logger.warn(
        `confirm-session ${sessionId}: no fulfilment handler ran; stripe metadata keys: ${Object.keys(session.metadata ?? {}).join(',') || '(none)'}`
      );
      await this.webhookEvents.markStatus(recordResult.event.id, 'ignored');
    }

    return { received: true, fulfilled: fulfilled === true };
  }

  /**
   * GoCardless confirmation backstop. `sessionId` is the billing request id;
   * the payment is considered complete once the billing request is fulfilled.
   * A synthetic `payments.confirmed` event (metadata already resolved from the
   * billing request) is fed through the same processor path as real webhooks.
   */
  private async confirmGoCardlessSession(sessionId: string) {
    if (!this.goCardlessService) {
      throw new BadRequestException('GoCardless is not available in this environment');
    }

    const billingRequest = await this.goCardlessService.getBillingRequest(sessionId);

    if (billingRequest.status !== 'fulfilled') {
      throw new BadRequestException(`Billing request is not fulfilled (status: ${billingRequest.status})`);
    }

    const metadata = unpackBillingRequestMetadata(billingRequest.metadata);
    const pendingPayment = await this.paymentsService.getPaymentByProviderCheckoutId(sessionId);

    const payment: GoCardlessPaymentResource = {
      id: pendingPayment?.providerPaymentId ?? billingRequest.links?.payment_request_payment ?? undefined,
      amount:
        pendingPayment && pendingPayment.grossAmount
          ? String(Math.round(Number(pendingPayment.grossAmount) * 100))
          : billingRequest.payment_request?.amount,
      currency: (pendingPayment?.currency ?? billingRequest.payment_request?.currency ?? 'GBP') as
        | GoCardlessPaymentResource['currency'],
      created_at: pendingPayment?.purchasedAt?.toISOString?.() ?? undefined,
      metadata,
      links: {
        billing_request: sessionId,
        mandate: pendingPayment ? undefined : (billingRequest.links?.mandate_request_mandate ?? undefined),
        subscription: billingRequest.links?.subscription_request_subscription ?? undefined,
        instalment_schedule:
          billingRequest.links?.instalment_schedule_request_instalment_schedule ?? undefined
      }
    };

    if (!payment.id) {
      throw new BadRequestException(
        'Billing request is fulfilled but no payment could be resolved for it yet; try again shortly'
      );
    }

    // Record a synthetic webhook event so the processor can update its ledger.
    const externalId = `confirm:${sessionId}`;
    const recordResult = await this.webhookEvents.record({
      provider: 'gocardless',
      eventType: 'payments.confirmed',
      externalId,
      payload: Buffer.from(JSON.stringify({ billingRequest, payment })),
      status: 'received'
    });

    // Only skip reprocessing when a previous confirmation actually succeeded.
    // A ledger row left in `received` or `failed` means the payment was never
    // applied. All handlers are idempotent, so replaying is safe.
    if (recordResult.isDuplicate && recordResult.event.status === 'processed') {
      return { received: true, duplicate: true };
    }

    const syntheticEvent = {
      id: externalId,
      action: 'confirmed',
      resource_type: 'payments',
      links: { payment: payment.id },
      body: { payments: payment }
    };

    const job: WebhookJobData = {
      ledgerId: recordResult.event.id,
      provider: 'gocardless',
      eventType: 'payments.confirmed',
      payload: syntheticEvent
    };

    await this.webhookProcessor.process(job);

    return { received: true };
  }
}
