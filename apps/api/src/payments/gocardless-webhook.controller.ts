import { Controller, Logger, Post, Headers, RawBody, Res } from '@nestjs/common';
import type { Response } from 'express';
import { Public } from '../common/decorators/public.decorator.js';
import { GoCardlessService } from './gocardless.service.js';
import { WebhookEventService } from './webhook-event.service.js';
import { WebhookQueueService } from './webhook-queue.service.js';
import type { GoCardlessWebhookEvent } from './gocardless-webhook.types.js';

interface GoCardlessWebhookBatch {
  events?: GoCardlessWebhookEvent[];
}

/**
 * GoCardless webhook endpoint.
 *
 * GoCardless drives fulfilment exclusively through webhooks: Billing Request
 * Flows redirect the payer back to the frontend, and every subsequent state
 * change (payment confirmed/failed, mandate activated, subscription payment
 * created, refunds) arrives here as a batch of events. Each event is recorded
 * in the WebhookEvent ledger and handed to the same queue worker that
 * processes Stripe events; the actual fulfilment is dispatched per event in
 * {@link WebhookProcessor} based on the checkout metadata stored on the
 * billing request.
 *
 * Like the Stripe endpoint, authentication is the Webhook-Signature HMAC of
 * the raw body rather than a session.
 */
@Controller('payments')
export class GoCardlessWebhookController {
  private readonly logger = new Logger(GoCardlessWebhookController.name);

  constructor(
    private readonly goCardlessService: GoCardlessService,
    private readonly webhookEvents: WebhookEventService,
    private readonly webhookQueue: WebhookQueueService
  ) {}

  @Post('gocardless/webhook')
  @Public()
  async handleWebhook(
    @Headers('webhook-signature') signature: string,
    @RawBody() rawBody: Buffer,
    @Res() res: Response
  ) {
    const webhookSecret = await this.goCardlessService.getWebhookSecret();
    if (!webhookSecret) {
      this.logger.warn('GoCardless webhook received but no webhook secret is configured.');
      return res.status(400).send('Webhook error: GoCardless webhook secret is not configured');
    }

    if (!signature || !this.goCardlessService.verifyWebhookSignature(rawBody, signature, webhookSecret)) {
      this.logger.warn('GoCardless webhook signature verification failed.');
      return res.status(400).send('Webhook error: signature verification failed');
    }

    let batch: GoCardlessWebhookBatch;
    try {
      batch = JSON.parse(rawBody.toString('utf8')) as GoCardlessWebhookBatch;
    } catch {
      return res.status(400).send('Webhook error: request body is not valid JSON');
    }

    const events = Array.isArray(batch?.events) ? batch.events : [];
    const results: Array<{ id: string; received?: boolean; duplicate?: boolean; error?: string }> = [];

    // GoCardless sends batches of unrelated events; each one is ledgered and
    // queued independently so a single bad event cannot drop the rest.
    let firstFailure: string | null = null;
    for (const event of events) {
      const eventType = `${event.resource_type}.${event.action}`;

      // A ledger failure means we cannot durably record the batch; fail the
      // whole request so GoCardless redelivers rather than silently dropping.
      const { event: ledgerEvent, isDuplicate } = await this.webhookEvents.record({
        provider: 'gocardless',
        eventType,
        externalId: event.id,
        payload: JSON.stringify(event),
        status: 'received'
      });

      if (isDuplicate) {
        this.logger.debug(`Duplicate GoCardless event ${event.id} ignored.`);
        results.push({ id: event.id, duplicate: true });
        continue;
      }

      try {
        await this.webhookQueue.addWebhookJob({
          ledgerId: ledgerEvent.id,
          provider: 'gocardless',
          eventType,
          payload: event
        });
        results.push({ id: event.id, received: true });
      } catch (err) {
        const message = (err as Error).message;
        this.logger.error(`GoCardless webhook ${event.id} enqueue failed: ${message}`);
        await this.webhookEvents.markStatus(ledgerEvent.id, 'failed', message);
        // Keep processing the rest of the batch; the failed event is reported
        // below so GoCardless still redelivers it.
        firstFailure ??= message;
        results.push({ id: event.id, error: message });
      }
    }

    if (firstFailure) {
      return res.status(500).send(`Webhook error: ${firstFailure}`);
    }

    return res.json({ received: true, events: results });
  }
}
