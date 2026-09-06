import { Controller, Logger, Post, Headers, RawBody, Res, Body, BadRequestException } from '@nestjs/common';
import type { Response } from 'express';
import { ApiBearerAuth } from '@nestjs/swagger';
import { Public } from '../common/decorators/public.decorator.js';
import { Roles } from '../common/decorators/roles.decorator.js';
import { UserRole } from '@kentslsc/shared';
import { GoCardlessService } from './gocardless.service.js';
import { WebhookEventService } from './webhook-event.service.js';
import { WebhookQueueService } from './webhook-queue.service.js';
import type { WebhookJobData } from '../queue/queue.types.js';
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
        if (ledgerEvent.status === 'failed') {
          // A previous delivery was ledgered but never processed (e.g. the
          // enqueue failed). GoCardless will not send anything new for it, so
          // re-queue it here; the handlers are idempotent.
          this.logger.log(`Re-queuing previously failed GoCardless event ${event.id}.`);
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
            this.logger.error(`GoCardless webhook ${event.id} re-enqueue failed: ${message}`);
            await this.webhookEvents.markStatus(ledgerEvent.id, 'failed', message);
            firstFailure ??= message;
            results.push({ id: event.id, error: message });
          }
        } else {
          this.logger.debug(`Duplicate GoCardless event ${event.id} ignored.`);
          results.push({ id: event.id, duplicate: true });
        }
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

  /**
   * Admin recovery: re-queue ledger rows left in `failed` status (e.g. enqueue
   * failures, or events that failed processing before a fix was deployed).
   * Events recorded before payloads were stored in the ledger cannot be
   * replayed and are reported as skipped. Processing is idempotent.
   */
  @Post('webhooks/replay-failed')
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth()
  async replayFailedWebhooks(@Body() body?: { limit?: number }) {
    const limit = Math.min(Math.max(body?.limit ?? 50, 1), 200);
    const failed = await this.webhookEvents.listFailed(limit);
    let requeued = 0;
    const skipped: string[] = [];

    for (const row of failed) {
      const provider = row.provider as WebhookJobData['provider'];
      if (!row.payload || !['stripe', 'gocardless', 'paypal'].includes(provider)) {
        skipped.push(row.id);
        continue;
      }
      try {
        await this.webhookQueue.addWebhookJob({
          ledgerId: row.id,
          provider,
          eventType: row.eventType,
          payload: row.payload as WebhookJobData['payload']
        });
        await this.webhookEvents.markStatus(row.id, 'received');
        requeued++;
      } catch (err) {
        const message = (err as Error).message;
        this.logger.error(`Replay of webhook event ${row.id} failed to enqueue: ${message}`);
        await this.webhookEvents.markStatus(row.id, 'failed', message);
      }
    }

    return { requeued, skipped: skipped.length, skippedIds: skipped };
  }
}
