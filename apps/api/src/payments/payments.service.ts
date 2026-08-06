import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Stripe from 'stripe';
import { PrismaService } from '../core/prisma/prisma.service.js';

const PROMOTION_DAYS = 30;

@Injectable()
export class PaymentsService {
  private stripe: Stripe;

  constructor(
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService
  ) {
    this.stripe = new Stripe(configService.getOrThrow<string>('STRIPE_SECRET_KEY'), {
      apiVersion: '2024-04-10'
    });
  }

  getClient() {
    return this.stripe;
  }

  async createCheckoutSession(params: Stripe.Checkout.SessionCreateParams) {
    return this.stripe.checkout.sessions.create(params);
  }

  async constructEvent(payload: Buffer | string, signature: string) {
    return this.stripe.webhooks.constructEvent(
      payload,
      signature,
      this.configService.getOrThrow<string>('STRIPE_WEBHOOK_SECRET')
    );
  }

  async handleDirectoryPromotion(session: Stripe.Checkout.Session) {
    const businessListingId = session.metadata?.businessListingId;
    if (!businessListingId) return;

    const promotedUntil = new Date();
    promotedUntil.setDate(promotedUntil.getDate() + PROMOTION_DAYS);

    await this.prisma.businessListing.updateMany({
      where: { id: businessListingId, deletedAt: null },
      data: { isPromoted: true, promotedUntil }
    });
  }
}
