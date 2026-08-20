import { Module } from '@nestjs/common';
import { PaymentsModule } from './payments.module.js';
import { EventsModule } from '../events/events.module.js';
import { MembershipsModule } from '../memberships/memberships.module.js';
import { FundraisingModule } from '../fundraising/fundraising.module.js';
import { DirectoryModule } from '../directory/directory.module.js';
import { StripeWebhookController } from './stripe-webhook.controller.js';
import { WebhookEventService } from './webhook-event.service.js';

/**
 * Dedicated module for the unified Stripe webhook endpoint.
 *
 * Keeping this separate from PaymentsModule avoids circular imports, because
 * PaymentsModule is imported by each of the feature modules below.
 */
@Module({
  imports: [PaymentsModule, EventsModule, MembershipsModule, FundraisingModule, DirectoryModule],
  providers: [WebhookEventService],
  controllers: [StripeWebhookController]
})
export class StripeWebhookModule {}
