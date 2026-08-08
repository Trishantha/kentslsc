import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Stripe from 'stripe';
import { PrismaService } from '../core/prisma/prisma.service.js';

const PROMOTION_DAYS = 30;

@Injectable()
export class PaymentsService {
  private stripe?: Stripe;

  constructor(
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService
  ) {
    const secretKey = configService.get<string>('STRIPE_SECRET_KEY');
    if (secretKey) {
      this.stripe = new Stripe(secretKey, {
        apiVersion: '2026-07-29.dahlia'
      });
    }
  }

  private ensureEnabled() {
    if (!this.stripe) {
      throw new Error('Stripe is not configured. Set STRIPE_SECRET_KEY to enable payments.');
    }
  }

  getClient() {
    this.ensureEnabled();
    return this.stripe!;
  }

  isEnabled(): boolean {
    return !!this.stripe;
  }

  async createCheckoutSession(params: Stripe.Checkout.SessionCreateParams) {
    this.ensureEnabled();
    return this.stripe!.checkout.sessions.create(params);
  }

  async constructEvent(payload: Buffer | string, signature: string) {
    this.ensureEnabled();
    const webhookSecret = this.configService.get<string>('STRIPE_WEBHOOK_SECRET');
    if (!webhookSecret) {
      throw new Error('Stripe webhook secret is not configured.');
    }
    return this.stripe!.webhooks.constructEvent(payload, signature, webhookSecret);
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
