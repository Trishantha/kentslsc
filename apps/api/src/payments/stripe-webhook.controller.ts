import { Controller, Logger, Post, Headers, RawBody, Res } from '@nestjs/common';
import type { Response } from 'express';
import type Stripe from 'stripe';
import { Public } from '../common/decorators/public.decorator.js';
import { PaymentsService } from './payments.service.js';
import { WebhookEventService } from './webhook-event.service.js';
import { WebhookQueueService } from './webhook-queue.service.js';

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
    private readonly webhookQueue: WebhookQueueService
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
}
