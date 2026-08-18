import { Controller, Post, Headers, RawBody, Res } from '@nestjs/common';
import type { Response } from 'express';
import type Stripe from 'stripe';
import { Public } from '../common/decorators/public.decorator.js';
import { PaymentsService } from './payments.service.js';
import { EventsService } from '../events/events.service.js';
import { MembershipsService } from '../memberships/memberships.service.js';
import { FundraisingService } from '../fundraising/fundraising.service.js';
import { DirectoryService } from '../directory/directory.service.js';

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
  constructor(
    private readonly paymentsService: PaymentsService,
    private readonly eventsService: EventsService,
    private readonly membershipsService: MembershipsService,
    private readonly fundraisingService: FundraisingService,
    private readonly directoryService: DirectoryService
  ) {}

  @Post('webhook')
  @Public()
  async handleWebhook(
    @Headers('stripe-signature') signature: string,
    @RawBody() rawBody: Buffer,
    @Res() res: Response
  ) {
    try {
      const event = await this.paymentsService.constructEvent(rawBody, signature);

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
          await this.directoryService.handlePromotionCompleted(metadata, 'stripe');
        } else if (metadata.type === 'job_publish') {
          await this.directoryService.handleJobPublishCompleted(metadata);
        }
      }

      return res.json({ received: true });
    } catch (err) {
      return res.status(400).send(`Webhook error: ${(err as Error).message}`);
    }
  }
}
