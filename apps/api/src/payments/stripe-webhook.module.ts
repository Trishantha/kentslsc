import { Module } from '@nestjs/common';
import { QueueModule } from '../queue/queue.module.js';
import { PaymentsModule } from './payments.module.js';
import { EventsModule } from '../events/events.module.js';
import { MembershipsModule } from '../memberships/memberships.module.js';
import { FundraisingModule } from '../fundraising/fundraising.module.js';
import { DirectoryModule } from '../directory/directory.module.js';
import { StripeWebhookController } from './stripe-webhook.controller.js';
import { WebhookEventService } from './webhook-event.service.js';
import { WebhookProcessor } from './webhook.processor.js';
import { WebhookWorkerService } from './webhook-worker.service.js';
import { WebhookQueueService } from './webhook-queue.service.js';

/**
 * Dedicated module for the unified Stripe webhook endpoint.
 *
 * Keeping this separate from PaymentsModule avoids circular imports, because
 * PaymentsModule is imported by each of the feature modules below.
 */
@Module({
  imports: [QueueModule, PaymentsModule, EventsModule, MembershipsModule, FundraisingModule, DirectoryModule],
  providers: [WebhookEventService, WebhookProcessor, WebhookWorkerService, WebhookQueueService],
  controllers: [StripeWebhookController],
  exports: [WebhookQueueService]
})
export class StripeWebhookModule {}
