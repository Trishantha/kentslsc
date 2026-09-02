import { Controller, Logger, Post, Headers, RawBody, Res, Body, BadRequestException } from '@nestjs/common';
import { ApiBearerAuth } from '@nestjs/swagger';
import type { Response } from 'express';
import type Stripe from 'stripe';
import { Public } from '../common/decorators/public.decorator.js';
import { OptionalAuthRoute } from '../common/decorators/optional-auth-route.decorator.js';
import { PaymentsService } from './payments.service.js';
import { WebhookEventService } from './webhook-event.service.js';
import { WebhookQueueService } from './webhook-queue.service.js';
import { WebhookProcessor } from './webhook.processor.js';
import type { WebhookJobData } from '../queue/queue.types.js';

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
    private readonly webhookProcessor: WebhookProcessor
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
   * Explicit success confirmation for any Stripe/PayPal checkout session.
   *
   * The frontend calls this when the payer returns from the gateway. It
   * protects against webhooks that are delayed, misconfigured, or dropped:
   * we ask Stripe/PayPal for the session status and run the same handlers
   * that the webhook worker would run. All handlers are idempotent, so
   * calling this after a successful webhook is safe.
   */
  @Post('confirm-session')
  @Public()
  @OptionalAuthRoute()
  @ApiBearerAuth()
  async confirmSession(@Body() body: { sessionId: string; provider: 'stripe' | 'paypal' }) {
    const { sessionId, provider } = body;

    if (!sessionId || !provider) {
      throw new BadRequestException('sessionId and provider are required');
    }

    if (provider === 'paypal') {
      throw new BadRequestException('PayPal confirmation is not yet supported');
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

    await this.webhookProcessor.process(job);

    return { received: true };
  }
}
