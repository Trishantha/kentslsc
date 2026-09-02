import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Stripe from 'stripe';
import crypto from 'crypto';
import {
  calculateProcessingFee,
  DEFAULT_PROCESSING_FEE,
  type ProcessingFeeConfig,
  type ProcessingFeeResult
} from '@kentslsc/shared';
import { PrismaService } from '../core/prisma/prisma.service.js';
import { PaymentSourceType, PaymentStatus } from '@kentslsc/database';
import type { Prisma } from '@kentslsc/database';
import type { UpdatePaymentSettingsDto } from './dto/update-payment-settings.dto.js';

const STRIPE_TIMEOUT_MS = 30_000;
const PAYPAL_TIMEOUT_MS = 30_000;

export type PaymentProvider = 'stripe' | 'paypal';

export type CheckoutUiMode = 'hosted' | 'embedded' | 'embedded_page';

export interface CreateCheckoutInput {
  provider?: PaymentProvider;
  amount?: number;
  currency?: string;
  description?: string;
  successUrl: string;
  cancelUrl: string;
  metadata?: Record<string, string>;
  customerEmail?: string;
  /** Stripe Customer id. When provided it takes precedence over customerEmail and locks the email field in Checkout. */
  customer?: string;
  mode?: 'payment' | 'subscription';
  lineItems?: Stripe.Checkout.SessionCreateParams.LineItem[];
  paymentMethodTypes?: Stripe.Checkout.SessionCreateParams.PaymentMethodType[];
  uiMode?: CheckoutUiMode;
  /** When false, processing fees are not added to the checkout total. Defaults to true. */
  includeProcessingFee?: boolean;
}

export interface CheckoutResult {
  provider: PaymentProvider;
  id: string;
  url: string;
  clientSecret?: string;
  netAmount?: number;
  processingFee?: number;
  grossAmount?: number;
}

export interface CheckoutSessionDetail {
  id: string;
  status: Stripe.Checkout.Session.Status | null;
  paymentStatus: Stripe.Checkout.Session.PaymentStatus;
  amountTotal: number;
  currency: string | null;
  metadata: Record<string, string> | null;
  customerEmail: string | null;
  paymentIntentId: string | null;
  lineItems:
    | { description: string | null; amount: number; quantity: number | null }[]
    | undefined;
}

export interface SyncedStripePrice {
  productId: string;
  priceId: string;
}

export interface CreateSubscriptionCheckoutInput {
  priceId: string;
  successUrl: string;
  cancelUrl: string;
  customer: string;
  metadata?: Record<string, string>;
  uiMode?: CheckoutUiMode;
}

export interface SubscriptionCheckoutResult {
  provider: 'stripe';
  id: string;
  url: string;
  clientSecret?: string;
}

interface EffectivePaymentSettings {
  provider: PaymentProvider;
  stripeSecretKey?: string;
  stripeWebhookSecret?: string;
  stripePublishableKey?: string;
  paypalClientId?: string;
  paypalClientSecret?: string;
  paypalApiBaseUrl: string;
  processingFeeConfig: ProcessingFeeConfig;
}

@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);
  private stripe?: Stripe;
  private defaultProvider: PaymentProvider;
  private paypalApiBaseUrl: string;

  constructor(
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService
  ) {
    this.defaultProvider = (configService.get<string>('DEFAULT_PAYMENT_PROVIDER') === 'paypal' ? 'paypal' : 'stripe');
    this.paypalApiBaseUrl = configService.get<string>('PAYPAL_API_BASE_URL') ?? 'https://api-m.sandbox.paypal.com';
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

  private async getEffectiveSettings(): Promise<EffectivePaymentSettings> {
    const persisted = await this.prisma.paymentSettings.findFirst();

    return {
      provider: (persisted?.provider as PaymentProvider | null) ?? this.defaultProvider,
      stripeSecretKey: persisted?.stripeSecretKey ?? this.configService.get<string>('STRIPE_SECRET_KEY') ?? undefined,
      stripeWebhookSecret: persisted?.stripeWebhookSecret ?? this.configService.get<string>('STRIPE_WEBHOOK_SECRET') ?? undefined,
      stripePublishableKey:
        persisted?.stripePublishableKey ?? this.configService.get<string>('STRIPE_PUBLISHABLE_KEY') ?? undefined,
      paypalClientId: persisted?.paypalClientId ?? this.configService.get<string>('PAYPAL_CLIENT_ID') ?? undefined,
      paypalClientSecret: persisted?.paypalClientSecret ?? this.configService.get<string>('PAYPAL_CLIENT_SECRET') ?? undefined,
      paypalApiBaseUrl: this.validatePayPalApiBaseUrl(
        persisted?.paypalApiBaseUrl ??
        this.configService.get<string>('PAYPAL_API_BASE_URL') ??
        'https://api-m.sandbox.paypal.com'
      ),
      processingFeeConfig: {
        enabled: persisted?.processingFeeEnabled ?? DEFAULT_PROCESSING_FEE.enabled,
        percent: persisted?.processingFeePercent ? Number(persisted.processingFeePercent) : DEFAULT_PROCESSING_FEE.percent,
        fixed: persisted?.processingFeeFixed ?? DEFAULT_PROCESSING_FEE.fixed
      }
    };
  }

  private ensureStripeClient(secretKey?: string) {
    if (!secretKey) {
      this.stripe = undefined;
      return;
    }

    if (!this.stripe) {
      this.stripe = new Stripe(secretKey, { apiVersion: '2026-07-29.dahlia', timeout: STRIPE_TIMEOUT_MS });
    }
  }

  /**
   * Get an existing Stripe Customer id for a user, or create one and persist it.
   * Using a Stripe Customer id in Checkout locks the email field so payers cannot
   * change it, preventing reconciliation errors.
   */
  async getOrCreateStripeCustomer(userId: string, email: string): Promise<string> {
    const effective = await this.getEffectiveSettings();
    this.ensureStripeClient(effective.stripeSecretKey);
    this.ensureEnabled();

    const user = await this.prisma.user.findUnique({
      where: { id: userId, deletedAt: null },
      select: { id: true, email: true, stripeCustomerId: true }
    });
    if (!user) {
      throw new Error(`Cannot create Stripe customer: user ${userId} not found`);
    }

    if (user.stripeCustomerId) {
      return user.stripeCustomerId;
    }

    const customer = await this.stripe!.customers.create({
      email: email.toLowerCase().trim(),
      metadata: { userId: user.id }
    });

    try {
      await this.prisma.user.update({
        where: { id: userId },
        data: { stripeCustomerId: customer.id }
      });
    } catch (err) {
      this.logger.warn(
        `Failed to persist stripeCustomerId ${customer.id} for user ${userId}: ${(err as Error).message}`
      );
    }

    return customer.id;
  }

  async getSettings() {
    const effective = await this.getEffectiveSettings();

    return {
      provider: effective.provider,
      hasStripeSecretKey: !!effective.stripeSecretKey,
      hasStripeWebhookSecret: !!effective.stripeWebhookSecret,
      hasStripePublishableKey: !!effective.stripePublishableKey,
      hasPaypalClientId: !!effective.paypalClientId,
      hasPaypalClientSecret: !!effective.paypalClientSecret,
      paypalApiBaseUrl: effective.paypalApiBaseUrl,
      processingFeeEnabled: effective.processingFeeConfig.enabled,
      processingFeePercent: effective.processingFeeConfig.percent,
      processingFeeFixed: effective.processingFeeConfig.fixed
    };
  }

  async getPublicPaymentSettings() {
    const effective = await this.getEffectiveSettings();
    return {
      provider: effective.provider,
      processingFeeEnabled: effective.processingFeeConfig.enabled,
      processingFeePercent: effective.processingFeeConfig.percent,
      processingFeeFixed: effective.processingFeeConfig.fixed
    };
  }

  async getStripePublishableKey() {
    const effective = await this.getEffectiveSettings();
    const key = effective.stripePublishableKey;
    if (key && key.startsWith('sk_')) {
      this.logger.error(
        'STRIPE_PUBLISHABLE_KEY is set to a secret key (starts with sk_). ' +
          'Stripe.js requires a publishable key (pk_). The checkout page will not load.'
      );
      return null;
    }
    return key ?? null;
  }

  /**
   * Retrieve a Stripe Checkout Session for the checkout confirmation page.
   *
   * Session IDs appear in browser URLs, so this endpoint treats them as
   * semi-public. To prevent PII and internal metadata leakage:
   *
   * - If the session is bound to a user (metadata.userId), the full detail is
   *   returned only when the caller is authenticated as that user.
   * - Anonymous sessions, and sessions accessed by anyone other than the owner,
   *   receive only the minimal confirmation fields required by the checkout UI.
   */
  async getCheckoutSession(
    sessionId: string,
    currentUserId?: string
  ): Promise<CheckoutSessionDetail> {
    const effective = await this.getEffectiveSettings();
    this.ensureStripeClient(effective.stripeSecretKey);
    this.ensureEnabled();

    const session = await this.stripe!.checkout.sessions.retrieve(sessionId, {
      expand: ['line_items']
    });

    const isOwner =
      !!session.metadata?.userId && session.metadata.userId === currentUserId;

    const paymentIntentId =
      typeof session.payment_intent === 'string'
        ? session.payment_intent
        : session.payment_intent?.id ?? null;

    return {
      id: session.id,
      status: session.status,
      paymentStatus: session.payment_status,
      amountTotal: session.amount_total ?? 0,
      currency: session.currency,
      metadata: isOwner ? session.metadata : null,
      customerEmail: isOwner
        ? (session.customer_details?.email ?? session.customer_email ?? null)
        : null,
      paymentIntentId: isOwner ? paymentIntentId : null,
      lineItems: session.line_items?.data.map((item) => ({
        description: item.description,
        amount: item.amount_total,
        quantity: item.quantity
      }))
    };
  }

  async getStripePaymentIntentIdFromSession(sessionId: string): Promise<string | null> {
    const effective = await this.getEffectiveSettings();
    this.ensureStripeClient(effective.stripeSecretKey);
    this.ensureEnabled();

    const session = await this.stripe!.checkout.sessions.retrieve(sessionId);
    return (
      typeof session.payment_intent === 'string'
        ? session.payment_intent
        : session.payment_intent?.id ?? null
    );
  }

  /**
   * Retrieve a full Stripe Checkout Session without owner-based metadata
   * filtering. This is intended for trusted backend confirmation flows where
   * the session id has already been validated.
   */
  async getFullCheckoutSession(sessionId: string): Promise<Stripe.Checkout.Session> {
    const effective = await this.getEffectiveSettings();
    this.ensureStripeClient(effective.stripeSecretKey);
    this.ensureEnabled();

    return this.stripe!.checkout.sessions.retrieve(sessionId, {
      expand: ['subscription.latest_invoice.payment_intent', 'payment_intent']
    });
  }

  /**
   * Resolve the PaymentIntent id tied to a Checkout Session. For one-off payments
   * it is on the session directly; for subscription checkouts the session has no
   * payment_intent and the charge lives on the subscription's latest invoice.
   */
  private resolvePaymentIntentIdFromSession(session: Stripe.Checkout.Session): string | null {
    const direct =
      typeof session.payment_intent === 'string'
        ? session.payment_intent
        : session.payment_intent?.id;
    if (direct) return direct;

    const subscription =
      typeof session.subscription === 'string' ? null : session.subscription;
    const latestInvoice =
      subscription && typeof subscription.latest_invoice !== 'string'
        ? (subscription.latest_invoice as Stripe.Invoice)
        : null;
    const invoicePaymentIntent =
      typeof (latestInvoice as any)?.payment_intent === 'string'
        ? (latestInvoice as any).payment_intent
        : (latestInvoice as any)?.payment_intent?.id;
    return invoicePaymentIntent ?? null;
  }

  /**
   * Update a Payment row with the actual fee and net settlement from Stripe's
   * balance transaction. This makes the revenue report match Stripe's payout
   * reporting instead of the estimated processing fee added at checkout.
   */
  async syncStripeFeesFromSession(session: Stripe.Checkout.Session): Promise<void> {
    const paymentIntentId = this.resolvePaymentIntentIdFromSession(session);
    if (!paymentIntentId) return;

    const payment = await this.prisma.payment.findFirst({
      where: { providerCheckoutId: session.id, deletedAt: null },
      orderBy: { createdAt: 'desc' }
    });
    if (!payment) return;

    try {
      const updateData: Prisma.PaymentUpdateInput = {};

      const existingProviderPaymentId = payment.providerPaymentId;
      if (
        !existingProviderPaymentId ||
        existingProviderPaymentId.startsWith('sub_')
      ) {
        updateData.providerPaymentId = paymentIntentId;
      }

      const subscriptionId =
        typeof session.subscription === 'string'
          ? session.subscription
          : session.subscription?.id;
      if (subscriptionId && !payment.providerSubscriptionId) {
        updateData.providerSubscriptionId = subscriptionId;
      }

      const feeDetails = await this.getStripeFeeDetails(paymentIntentId);
      if (feeDetails) {
        updateData.processingFee = feeDetails.fee;
        updateData.netAmount = feeDetails.net;
      }

      if (Object.keys(updateData).length > 0) {
        await this.prisma.payment.update({ where: { id: payment.id }, data: updateData });
      }
    } catch (err) {
      this.logger.warn(
        `Could not sync Stripe fees for session ${session.id}: ${(err as Error).message}`
      );
    }
  }

  /**
   * Update a Payment row with the actual fee and net settlement from Stripe's
   * balance transaction, looked up by PaymentIntent id. This is used for
   * subscription renewals and any other payment where we know the PaymentIntent
   * but not the original Checkout Session.
   */
  async syncStripeFeesByPaymentIntent(
    paymentIntentId: string,
    paymentId?: string
  ): Promise<void> {
    if (!paymentIntentId || !paymentId || !paymentIntentId.startsWith('pi_')) return;

    try {
      const feeDetails = await this.getStripeFeeDetails(paymentIntentId);
      if (!feeDetails) return;

      await this.prisma.payment.update({
        where: { id: paymentId },
        data: {
          processingFee: feeDetails.fee,
          netAmount: feeDetails.net
        }
      });
    } catch (err) {
      this.logger.warn(
        `Could not sync Stripe fees for payment ${paymentId}: ${(err as Error).message}`
      );
    }
  }

  /**
   * Pull completed Stripe Checkout sessions into the local Payment ledger so the
   * revenue report matches Stripe. Creates missing Payment rows and updates
   * existing ones with actual fees, net settlement and refund status.
   */
  async syncStripeRevenue(dateRange?: {
    from?: Date;
    to?: Date;
  }): Promise<{ created: number; updated: number; skipped: number; errors: string[] }> {
    const effective = await this.getEffectiveSettings();
    this.ensureStripeClient(effective.stripeSecretKey);
    this.ensureEnabled();

    const now = new Date();
    const maxLookback = new Date(now);
    maxLookback.setDate(maxLookback.getDate() - 90);

    const from = dateRange?.from ? new Date(dateRange.from) : maxLookback;
    const to = dateRange?.to ? new Date(dateRange.to) : now;

    // Clamp to a sane window to avoid rate limits and huge scans.
    if (from < maxLookback) {
      from.setTime(maxLookback.getTime());
    }
    if (to > now) {
      to.setTime(now.getTime());
    }

    const params: Stripe.Checkout.SessionListParams = {
      limit: 100,
      status: 'complete',
      expand: ['data.subscription.latest_invoice.payment_intent'],
      created: {
        gte: Math.floor(from.getTime() / 1000),
        lte: Math.ceil(to.getTime() / 1000)
      }
    };

    const result = { created: 0, updated: 0, skipped: 0, errors: [] as string[] };

    let hasMore = true;
    let startingAfter: string | undefined;

    while (hasMore) {
      const page = await this.stripe!.checkout.sessions.list({
        ...params,
        ...(startingAfter && { starting_after: startingAfter })
      });

      for (const session of page.data) {
        try {
          if (session.payment_status !== 'paid') {
            result.skipped++;
            continue;
          }

          const existing = await this.prisma.payment.findFirst({
            where: { providerCheckoutId: session.id, deletedAt: null },
            orderBy: { createdAt: 'desc' },
            select: {
              id: true,
              providerPaymentId: true,
              paymentStatus: true,
              refundedAmount: true,
              grossAmount: true
            }
          });

          if (existing) {
            await this.updatePaymentFromStripeSession(existing, session);
            result.updated++;
          } else {
            await this.createPaymentFromStripeSession(session);
            result.created++;
          }
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          this.logger.warn(`Stripe sync failed for session ${session.id}: ${message}`);
          result.errors.push(`session ${session.id}: ${message}`);
        }
      }

      hasMore = page.has_more && page.data.length > 0;
      startingAfter = hasMore ? page.data[page.data.length - 1]!.id : undefined;
    }

    // Subscription renewals are recorded with providerCheckoutId set to the
    // Stripe Invoice id, so they are not matched by the session scan above.
    // Backfill their actual fees using the stored PaymentIntent id.
    try {
      const invoicePayments = await this.prisma.payment.findMany({
        where: {
          deletedAt: null,
          paymentChannel: 'stripe',
          providerPaymentId: { startsWith: 'pi_' },
          OR: [
            { providerCheckoutId: { startsWith: 'in_' } },
            { providerCheckoutId: null }
          ],
          purchasedAt: {
            gte: from,
            lte: to
          }
        },
        select: {
          id: true,
          providerPaymentId: true,
          paymentStatus: true,
          refundedAmount: true,
          grossAmount: true
        }
      });

      for (const payment of invoicePayments) {
        if (!payment.providerPaymentId) continue;
        try {
          await this.updatePaymentFromStripePaymentIntent(payment, payment.providerPaymentId);
          result.updated++;
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          this.logger.warn(
            `Stripe sync failed for invoice payment ${payment.id}: ${message}`
          );
          result.errors.push(`invoice payment ${payment.id}: ${message}`);
        }
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.warn(`Stripe invoice payment sync failed: ${message}`);
      result.errors.push(`invoice scan: ${message}`);
    }

    return result;
  }

  private async updatePaymentFromStripeSession(
    payment: {
      id: string;
      providerPaymentId: string | null;
      paymentStatus: PaymentStatus;
      refundedAmount: number | Prisma.Decimal | null;
      grossAmount: number | Prisma.Decimal;
    },
    session: Stripe.Checkout.Session
  ): Promise<void> {
    const paymentIntentId = this.resolvePaymentIntentIdFromSession(session);
    if (!paymentIntentId) return;

    const updateData: Prisma.PaymentUpdateInput = {};

    // Backfill the Payment Intent id if the row was created before this field
    // was populated, or if it was mistakenly set to the subscription id.
    const existingProviderPaymentId = payment.providerPaymentId;
    if (
      !existingProviderPaymentId ||
      existingProviderPaymentId.startsWith('sub_')
    ) {
      updateData.providerPaymentId = paymentIntentId;
    }

    const subscriptionId =
      typeof session.subscription === 'string'
        ? session.subscription
        : session.subscription?.id;
    if (subscriptionId) {
      updateData.providerSubscriptionId = subscriptionId;
    }

    const feeDetails = await this.getStripeFeeDetails(paymentIntentId);
    if (feeDetails) {
      updateData.processingFee = feeDetails.fee;
      updateData.netAmount = feeDetails.net;
    }

    const refundInfo = await this.getStripeRefundInfo(paymentIntentId);
    if (refundInfo && refundInfo.refundedAmount > 0) {
      const currentRefunded = Number(payment.refundedAmount ?? 0);
      const newRefunded = refundInfo.refundedAmount / 100;
      if (newRefunded > currentRefunded) {
        updateData.refundedAmount = newRefunded;
        const grossAmount = Number(payment.grossAmount);
        if (grossAmount > 0 && newRefunded >= grossAmount - 0.001) {
          updateData.paymentStatus = PaymentStatus.REFUNDED;
        } else if (payment.paymentStatus !== PaymentStatus.REFUNDED) {
          updateData.paymentStatus = PaymentStatus.PARTIALLY_REFUNDED;
        }
      }
    }

    if (Object.keys(updateData).length > 0) {
      await this.prisma.payment.update({ where: { id: payment.id }, data: updateData });
    }
  }

  private async updatePaymentFromStripePaymentIntent(
    payment: {
      id: string;
      providerPaymentId: string | null;
      paymentStatus: PaymentStatus;
      refundedAmount: number | Prisma.Decimal | null;
      grossAmount: number | Prisma.Decimal;
    },
    paymentIntentId: string
  ): Promise<void> {
    if (!paymentIntentId.startsWith('pi_')) return;

    const updateData: Prisma.PaymentUpdateInput = {};

    const existingProviderPaymentId = payment.providerPaymentId;
    if (
      !existingProviderPaymentId ||
      existingProviderPaymentId.startsWith('sub_')
    ) {
      updateData.providerPaymentId = paymentIntentId;
    }

    const feeDetails = await this.getStripeFeeDetails(paymentIntentId);
    if (feeDetails) {
      updateData.processingFee = feeDetails.fee;
      updateData.netAmount = feeDetails.net;
    }

    const refundInfo = await this.getStripeRefundInfo(paymentIntentId);
    if (refundInfo && refundInfo.refundedAmount > 0) {
      const currentRefunded = Number(payment.refundedAmount ?? 0);
      const newRefunded = refundInfo.refundedAmount / 100;
      if (newRefunded > currentRefunded) {
        updateData.refundedAmount = newRefunded;
        const grossAmount = Number(payment.grossAmount);
        if (grossAmount > 0 && newRefunded >= grossAmount - 0.001) {
          updateData.paymentStatus = PaymentStatus.REFUNDED;
        } else if (payment.paymentStatus !== PaymentStatus.REFUNDED) {
          updateData.paymentStatus = PaymentStatus.PARTIALLY_REFUNDED;
        }
      }
    }

    if (Object.keys(updateData).length > 0) {
      await this.prisma.payment.update({ where: { id: payment.id }, data: updateData });
    }
  }

  private async createPaymentFromStripeSession(session: Stripe.Checkout.Session): Promise<void> {
    const metadata = session.metadata ?? {};
    const sourceType = this.inferSourceType(metadata);
    const currency = (session.currency ?? 'gbp').toUpperCase();
    const grossAmount = this.amountFromSession(session);

    const paymentIntentId = this.resolvePaymentIntentIdFromSession(session);

    const customer = session.customer_details;
    const purchasedAt = session.created ? new Date(session.created * 1000) : new Date();

    let fee = 0;
    let net = grossAmount;
    if (paymentIntentId) {
      const feeDetails = await this.getStripeFeeDetails(paymentIntentId);
      if (feeDetails) {
        fee = feeDetails.fee;
        net = feeDetails.net;
      }
    }

    const description = this.inferDescription(sourceType, session);
    const sourceIds = await this.inferSourceIds(sourceType, metadata, session);
    const subscriptionId =
      typeof session.subscription === 'string'
        ? session.subscription
        : session.subscription?.id;

    await this.prisma.payment.create({
      data: {
        paymentChannel: 'stripe',
        paymentMethod: session.payment_method_types?.[0] ?? 'card',
        paymentStatus: PaymentStatus.COMPLETED,
        providerCheckoutId: session.id,
        providerPaymentId: paymentIntentId,
        providerSubscriptionId: subscriptionId ?? null,
        currency,
        grossAmount,
        processingFee: fee,
        netAmount: net,
        description,
        notes: 'Synced from Stripe Checkout',
        payerName: customer?.name ?? null,
        payerEmail: customer?.email ?? session.customer_email ?? null,
        payerPhone: customer?.phone ?? null,
        payerAddressLine1: customer?.address?.line1 ?? null,
        payerAddressLine2: customer?.address?.line2 ?? null,
        payerCity: customer?.address?.city ?? null,
        payerPostcode: customer?.address?.postal_code ?? null,
        payerCountry: customer?.address?.country ?? null,
        purchasedAt,
        sourceType,
        ...sourceIds,
        metadata: {
          ...metadata,
          syncedAt: new Date().toISOString(),
          sessionRef: session.id
        } as unknown as Prisma.InputJsonValue
      }
    });
  }

  private amountFromSession(session: Stripe.Checkout.Session): number {
    return (session.amount_total ?? 0) / 100;
  }

  private inferSourceType(metadata: Record<string, string>): PaymentSourceType {
    if (metadata.source === 'membership') return PaymentSourceType.MEMBERSHIP;
    switch (metadata.type) {
      case 'event_ticket':
        return PaymentSourceType.TICKET;
      case 'donation':
        return PaymentSourceType.DONATION;
      case 'directory_promotion':
        return PaymentSourceType.DIRECTORY_PROMOTION;
      case 'job_publish':
        return PaymentSourceType.JOB_PUBLISH;
      default:
        return PaymentSourceType.MANUAL;
    }
  }

  private inferDescription(
    sourceType: PaymentSourceType,
    session: Stripe.Checkout.Session
  ): string | null {
    const metadata = session.metadata ?? {};
    switch (sourceType) {
      case PaymentSourceType.TICKET:
        return metadata.eventTitle ? `Ticket(s) for ${metadata.eventTitle}` : 'Ticket purchase';
      case PaymentSourceType.MEMBERSHIP:
        return metadata.membershipTypeName
          ? `Membership: ${metadata.membershipTypeName}`
          : 'Membership payment';
      case PaymentSourceType.DONATION:
        return metadata.fundraiserTitle
          ? `Donation to ${metadata.fundraiserTitle}`
          : 'Donation';
      case PaymentSourceType.DIRECTORY_PROMOTION:
        return metadata.businessName
          ? `Directory promotion: ${metadata.businessName}`
          : 'Directory promotion';
      case PaymentSourceType.JOB_PUBLISH:
        return metadata.jobTitle ? `Job publish: ${metadata.jobTitle}` : 'Job publish';
      default:
        return session.line_items?.data[0]?.description ?? 'Stripe payment';
    }
  }

  private async inferSourceIds(
    sourceType: PaymentSourceType,
    metadata: Record<string, string>,
    session: Stripe.Checkout.Session
  ): Promise<{
    userId: string | null;
    eventId?: string | null;
    ticketId?: string | null;
    membershipId?: string | null;
    donationId?: string | null;
    businessListingId?: string | null;
    jobAdId?: string | null;
  }> {
    const ids: {
      userId: string | null;
      eventId?: string | null;
      ticketId?: string | null;
      membershipId?: string | null;
      donationId?: string | null;
      businessListingId?: string | null;
      jobAdId?: string | null;
    } = { userId: metadata.userId ?? null };

    const customerId =
      typeof session.customer === 'string' ? session.customer : session.customer?.id ?? null;

    switch (sourceType) {
      case PaymentSourceType.TICKET:
        ids.eventId = metadata.eventId ?? null;
        break;
      case PaymentSourceType.MEMBERSHIP:
        ids.membershipId = metadata.membershipId ?? null;
        break;
      case PaymentSourceType.DONATION:
        ids.donationId = metadata.donationId ?? null;
        break;
      case PaymentSourceType.DIRECTORY_PROMOTION:
        ids.businessListingId = metadata.businessListingId ?? null;
        break;
      case PaymentSourceType.JOB_PUBLISH:
        ids.jobAdId = metadata.jobAdId ?? null;
        break;
    }

    if (!ids.userId && customerId) {
      // Best-effort lookup by Stripe customer id.
      const user = await this.prisma.user.findFirst({
        where: { stripeCustomerId: customerId, deletedAt: null },
        select: { id: true }
      });
      if (user) ids.userId = user.id;
    }

    return ids;
  }

  private async getStripeRefundInfo(
    paymentIntentId: string
  ): Promise<{ refundedAmount: number } | null> {
    this.ensureEnabled();
    try {
      const refunds = await this.stripe!.refunds.list({ payment_intent: paymentIntentId, limit: 100 });
      const refundedAmount = refunds.data.reduce((sum, r) => sum + (r.amount ?? 0), 0);
      if (refundedAmount <= 0) return null;
      return { refundedAmount };
    } catch (err) {
      this.logger.warn(
        `Could not fetch Stripe refunds for ${paymentIntentId}: ${(err as Error).message}`
      );
      return null;
    }
  }

  private async getStripeFeeDetails(
    paymentIntentId: string
  ): Promise<{ fee: number; net: number } | null> {
    this.ensureEnabled();
    const pi = await this.stripe!.paymentIntents.retrieve(paymentIntentId, {
      expand: ['latest_charge.balance_transaction']
    });

    const latestCharge = pi.latest_charge;
    if (!latestCharge) return null;

    let balanceTransaction: Stripe.BalanceTransaction | string | null | undefined;
    if (typeof latestCharge === 'string') {
      const charge = await this.stripe!.charges.retrieve(latestCharge, {
        expand: ['balance_transaction']
      });
      balanceTransaction = charge.balance_transaction;
    } else {
      balanceTransaction = latestCharge.balance_transaction;
    }

    if (!balanceTransaction) return null;

    if (typeof balanceTransaction === 'string') {
      const tx = await this.stripe!.balanceTransactions.retrieve(balanceTransaction);
      return { fee: tx.fee / 100, net: tx.net / 100 };
    }

    return { fee: balanceTransaction.fee / 100, net: balanceTransaction.net / 100 };
  }

  async findByUser(userId: string, page = 1, limit = 50) {
    const [data, total] = await Promise.all([
      this.prisma.payment.findMany({
        where: { userId, deletedAt: null },
        orderBy: { purchasedAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        include: {
          event: { select: { id: true, title: true, startDatetime: true, location: true } },
          membership: { select: { id: true, membershipId: true, membershipType: { select: { name: true } } } },
          donation: { select: { id: true, fundraiser: { select: { title: true } } } },
          businessListing: { select: { id: true, businessName: true } },
          jobAd: { select: { id: true, title: true } }
        }
      }),
      this.prisma.payment.count({ where: { userId, deletedAt: null } })
    ]);

    return {
      data: data.map((p) => ({
        ...p,
        grossAmount: Number(p.grossAmount),
        processingFee: Number(p.processingFee),
        netAmount: Number(p.netAmount),
        refundedAmount: p.refundedAmount ? Number(p.refundedAmount) : null
      })),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit)
    };
  }

  async updateSettings(dto: UpdatePaymentSettingsDto) {
    const existing = await this.prisma.paymentSettings.findFirst();
    const payload = {
      ...(dto.provider !== undefined && { provider: dto.provider }),
      ...(dto.stripeSecretKey !== undefined && { stripeSecretKey: dto.stripeSecretKey || null }),
      ...(dto.stripeWebhookSecret !== undefined && { stripeWebhookSecret: dto.stripeWebhookSecret || null }),
      ...(dto.stripePublishableKey !== undefined && { stripePublishableKey: dto.stripePublishableKey || null }),
      ...(dto.paypalClientId !== undefined && { paypalClientId: dto.paypalClientId || null }),
      ...(dto.paypalClientSecret !== undefined && { paypalClientSecret: dto.paypalClientSecret || null }),
      ...(dto.paypalApiBaseUrl !== undefined && {
        paypalApiBaseUrl: dto.paypalApiBaseUrl
          ? this.validatePayPalApiBaseUrl(dto.paypalApiBaseUrl)
          : null
      }),
      ...(dto.processingFeeEnabled !== undefined && { processingFeeEnabled: dto.processingFeeEnabled }),
      ...(dto.processingFeePercent !== undefined && { processingFeePercent: dto.processingFeePercent }),
      ...(dto.processingFeeFixed !== undefined && { processingFeeFixed: dto.processingFeeFixed })
    };

    if (existing) {
      await this.prisma.paymentSettings.update({ where: { id: existing.id }, data: payload });
    } else {
      await this.prisma.paymentSettings.create({ data: payload });
    }

    this.defaultProvider = dto.provider ?? this.defaultProvider;
    if (dto.provider !== undefined) {
      this.defaultProvider = dto.provider;
    }

    if (dto.stripeSecretKey !== undefined && dto.stripeSecretKey) {
      this.stripe = new Stripe(dto.stripeSecretKey, { apiVersion: '2026-07-29.dahlia', timeout: STRIPE_TIMEOUT_MS });
    }

    this.paypalApiBaseUrl = dto.paypalApiBaseUrl || this.paypalApiBaseUrl;

    return this.getSettings();
  }

  calculateProcessingFee(netPence: number, effective?: EffectivePaymentSettings): ProcessingFeeResult {
    const config = effective?.processingFeeConfig ?? DEFAULT_PROCESSING_FEE;
    return calculateProcessingFee(netPence, config);
  }

  async createCheckout(input: CreateCheckoutInput): Promise<CheckoutResult> {
    const effective = await this.getEffectiveSettings();
    const provider = input.provider ?? effective.provider;

    if (provider === 'paypal') {
      return this.createPayPalCheckout(input, effective);
    }

    return this.createStripeCheckout(input, effective);
  }

  async createStripeCheckout(input: CreateCheckoutInput, effective: EffectivePaymentSettings): Promise<CheckoutResult> {
    this.ensureStripeClient(effective.stripeSecretKey);
    this.ensureEnabled();

    const currency = (input.currency ?? 'gbp').toLowerCase();
    const netAmount = input.amount ?? 0;
    const includeProcessingFee = input.includeProcessingFee !== false;
    const feeResult = includeProcessingFee
      ? this.calculateProcessingFee(netAmount, effective)
      : { net: netAmount, fee: 0, gross: netAmount };

    let lineItems: Stripe.Checkout.SessionCreateParams.LineItem[];
    if (input.lineItems) {
      lineItems = input.lineItems;
    } else if (feeResult.fee > 0) {
      lineItems = [
        {
          price_data: {
            currency,
            unit_amount: feeResult.net,
            product_data: {
              name: input.description ?? 'Payment'
            }
          },
          quantity: 1
        },
        {
          price_data: {
            currency,
            unit_amount: feeResult.fee,
            product_data: {
              name: 'Processing fee'
            }
          },
          quantity: 1
        }
      ];
    } else {
      lineItems = [
        {
          price_data: {
            currency,
            unit_amount: netAmount,
            product_data: {
              name: input.description ?? 'Payment'
            }
          },
          quantity: 1
        }
      ];
    }

    const uiMode = input.uiMode === 'embedded' ? 'embedded_page' : input.uiMode;
    const isEmbedded = uiMode === 'embedded_page';

    const session = await this.stripe!.checkout.sessions.create({
      mode: input.mode ?? 'payment',
      payment_method_types: input.paymentMethodTypes ?? ['card'],
      line_items: lineItems,
      ...(input.customer
        ? { customer: input.customer }
        : input.customerEmail
          ? { customer_email: input.customerEmail }
          : {}),
      ...(isEmbedded
        ? {
            ui_mode: 'embedded_page',
            return_url: input.successUrl,
            redirect_on_completion: 'always' as const
          }
        : {
            success_url: input.successUrl,
            cancel_url: input.cancelUrl
          }),
      metadata: {
        ...input.metadata,
        netAmount: String(feeResult.net),
        processingFee: String(feeResult.fee),
        grossAmount: String(feeResult.gross)
      }
    });

    return {
      provider: 'stripe',
      id: session.id,
      url: session.url ?? input.successUrl,
      clientSecret: isEmbedded ? (session.client_secret ?? undefined) : undefined,
      netAmount: feeResult.net,
      processingFee: feeResult.fee,
      grossAmount: feeResult.gross
    };
  }

  /**
   * Ensure a paid membership type has a corresponding Stripe Product and recurring Price.
   * Creates them if missing and persists the IDs on the membership type.
   */
  async syncMembershipTypePrice(
    type: { id: string; name: string; price: number; durationMonths: number },
    effective?: EffectivePaymentSettings
  ): Promise<SyncedStripePrice> {
    const settings = effective ?? (await this.getEffectiveSettings());
    this.ensureStripeClient(settings.stripeSecretKey);
    this.ensureEnabled();

    let productId = type.id;
    const existingProduct = await this.stripe!.products.search({
      query: `metadata['membershipTypeId']:'${type.id}'`,
      limit: 1
    });
    const matchedProductId = existingProduct.data[0]?.id;
    if (matchedProductId) {
      productId = matchedProductId;
    } else {
      const product = await this.stripe!.products.create({
        name: type.name,
        metadata: { membershipTypeId: type.id }
      });
      productId = product.id;
    }

    const unitAmount = Math.round(type.price * 100);
    const prices = await this.stripe!.prices.list({
      product: productId,
      type: 'recurring',
      active: true,
      limit: 100
    });

    const matched = prices.data.find(
      (p) =>
        p.unit_amount === unitAmount &&
        p.recurring?.interval === 'month' &&
        p.recurring?.interval_count === type.durationMonths
    );

    if (matched) {
      return { productId, priceId: matched.id };
    }

    const price = await this.stripe!.prices.create({
      product: productId,
      unit_amount: unitAmount,
      currency: 'gbp',
      recurring: {
        interval: 'month',
        interval_count: type.durationMonths
      },
      metadata: { membershipTypeId: type.id }
    });

    return { productId, priceId: price.id };
  }

  async createSubscriptionCheckout(
    input: CreateSubscriptionCheckoutInput,
    effective?: EffectivePaymentSettings
  ): Promise<SubscriptionCheckoutResult> {
    const settings = effective ?? (await this.getEffectiveSettings());
    this.ensureStripeClient(settings.stripeSecretKey);
    this.ensureEnabled();

    const uiMode = input.uiMode === 'embedded' ? 'embedded_page' : input.uiMode;
    const isEmbedded = uiMode === 'embedded_page';

    const session = await this.stripe!.checkout.sessions.create({
      mode: 'subscription',
      payment_method_types: ['card'],
      line_items: [{ price: input.priceId, quantity: 1 }],
      customer: input.customer,
      ...(isEmbedded
        ? {
            ui_mode: 'embedded_page',
            return_url: input.successUrl,
            redirect_on_completion: 'always' as const
          }
        : {
            success_url: input.successUrl,
            cancel_url: input.cancelUrl
          }),
      metadata: input.metadata,
      subscription_data: {
        metadata: input.metadata
      }
    });

    return {
      provider: 'stripe',
      id: session.id,
      url: session.url ?? input.successUrl,
      clientSecret: isEmbedded ? (session.client_secret ?? undefined) : undefined
    };
  }

  async createBillingPortalSession(customerId: string, returnUrl: string): Promise<string> {
    const effective = await this.getEffectiveSettings();
    this.ensureStripeClient(effective.stripeSecretKey);
    this.ensureEnabled();

    const session = await this.stripe!.billingPortal.sessions.create({
      customer: customerId,
      return_url: returnUrl
    });

    return session.url;
  }

  async cancelSubscription(stripeSubscriptionId: string): Promise<void> {
    const effective = await this.getEffectiveSettings();
    this.ensureStripeClient(effective.stripeSecretKey);
    this.ensureEnabled();

    await this.stripe!.subscriptions.update(stripeSubscriptionId, { cancel_at_period_end: true });
  }

  async updateSubscriptionPrice(
    stripeSubscriptionId: string,
    subscriptionItemId: string,
    newPriceId: string,
    prorationBehavior: Stripe.SubscriptionUpdateParams.ProrationBehavior = 'create_prorations'
  ): Promise<Stripe.Subscription> {
    const effective = await this.getEffectiveSettings();
    this.ensureStripeClient(effective.stripeSecretKey);
    this.ensureEnabled();

    return this.stripe!.subscriptions.update(stripeSubscriptionId, {
      proration_behavior: prorationBehavior,
      items: [{ id: subscriptionItemId, price: newPriceId }]
    });
  }

  async getSubscription(stripeSubscriptionId: string): Promise<Stripe.Subscription> {
    const effective = await this.getEffectiveSettings();
    this.ensureStripeClient(effective.stripeSecretKey);
    this.ensureEnabled();

    return this.stripe!.subscriptions.retrieve(stripeSubscriptionId, {
      expand: ['latest_invoice.payment_intent']
    });
  }

  async getInvoice(invoiceId: string): Promise<Stripe.Invoice> {
    const effective = await this.getEffectiveSettings();
    this.ensureStripeClient(effective.stripeSecretKey);
    this.ensureEnabled();

    return this.stripe!.invoices.retrieve(invoiceId);
  }

  async refundStripePaymentIntent(paymentIntentId: string, amount?: number, reason?: string) {
    const effective = await this.getEffectiveSettings();
    this.ensureStripeClient(effective.stripeSecretKey);
    this.ensureEnabled();

    const refund = await this.stripe!.refunds.create({
      payment_intent: paymentIntentId,
      ...(amount !== undefined && { amount }),
      ...(reason && { reason: 'requested_by_customer' })
    });

    return { providerRefundId: refund.id, status: refund.status };
  }

  async refundPayPalCapture(captureId: string, amount?: number, currency = 'GBP') {
    const effective = await this.getEffectiveSettings();
    if (!effective.paypalClientId || !effective.paypalClientSecret) {
      throw new Error('PayPal is not configured');
    }
    const token = await this.getPayPalAccessToken(effective);

    const body: { amount?: { currency_code: string; value: string } } = {};
    if (amount !== undefined) {
      body.amount = { currency_code: currency.toUpperCase(), value: (amount / 100).toFixed(2) };
    }

    const response = await fetch(`${effective.paypalApiBaseUrl}/v2/payments/captures/${captureId}/refund`, {
      signal: AbortSignal.timeout(PAYPAL_TIMEOUT_MS),
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        'Prefer': 'return=representation'
      },
      body: Object.keys(body).length > 0 ? JSON.stringify(body) : undefined
    });

    if (!response.ok) {
      const detail = await response.text();
      throw new Error(`PayPal refund failed: ${detail}`);
    }

    const data = (await response.json()) as { id?: string; status?: string };
    return { providerRefundId: data.id ?? captureId, status: data.status ?? 'COMPLETED' };
  }

  async createPayPalCheckout(input: CreateCheckoutInput, effective: EffectivePaymentSettings): Promise<CheckoutResult> {
    if (!effective.paypalClientId || !effective.paypalClientSecret) {
      throw new Error('PayPal is not configured. Set PAYPAL_CLIENT_ID and PAYPAL_CLIENT_SECRET to enable PayPal payments.');
    }

    const currency = (input.currency ?? 'GBP').toUpperCase();
    const amountValue = ((input.amount ?? 0) / 100).toFixed(2);
    const token = await this.getPayPalAccessToken(effective);

    const response = await fetch(`${effective.paypalApiBaseUrl}/v2/checkout/orders`, {
      signal: AbortSignal.timeout(PAYPAL_TIMEOUT_MS),
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        intent: 'CAPTURE',
        purchase_units: [
          {
            amount: {
              currency_code: currency,
              value: amountValue
            },
            description: input.description ?? 'Payment',
            custom_id: JSON.stringify(input.metadata ?? {})
          }
        ],
        application_context: {
          return_url: input.successUrl,
          cancel_url: input.cancelUrl,
          brand_name: 'Kent SLSC',
          shipping_preference: 'NO_SHIPPING'
        }
      })
    });

    if (!response.ok) {
      const detail = await response.text();
      throw new Error(`PayPal checkout failed: ${detail}`);
    }

    const data = await response.json() as { id?: string; links?: Array<{ rel?: string; href?: string }> };
    const approveLink = data.links?.find((link) => link.rel === 'approve')?.href;

    const netAmount = input.amount ?? 0;
    return {
      provider: 'paypal',
      id: data.id ?? '',
      url: approveLink ?? input.successUrl,
      netAmount,
      processingFee: 0,
      grossAmount: netAmount
    };
  }

  private async getPayPalAccessToken(effective: EffectivePaymentSettings) {
    const response = await fetch(`${effective.paypalApiBaseUrl}/v1/oauth2/token`, {
      signal: AbortSignal.timeout(PAYPAL_TIMEOUT_MS),
      method: 'POST',
      headers: {
        Authorization: `Basic ${Buffer.from(`${effective.paypalClientId!}:${effective.paypalClientSecret!}`).toString('base64')}`,
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: 'grant_type=client_credentials'
    });

    if (!response.ok) {
      throw new Error('Failed to authenticate with PayPal');
    }

    const data = await response.json() as { access_token?: string };
    if (!data.access_token) {
      throw new Error('PayPal access token was not returned');
    }

    return data.access_token;
  }

  async constructEvent(payload: Buffer | string, signature: string) {
    const effective = await this.getEffectiveSettings();
    this.ensureStripeClient(effective.stripeSecretKey);
    this.ensureEnabled();
    const webhookSecret = effective.stripeWebhookSecret;
    if (!webhookSecret) {
      throw new Error('Stripe webhook secret is not configured.');
    }
    return this.stripe!.webhooks.constructEvent(payload, signature, webhookSecret);
  }

  private readonly allowedPayPalUrls = [
    'https://api-m.sandbox.paypal.com',
    'https://api-m.paypal.com'
  ];

  private isValidPayPalApiBaseUrl(url: string | null | undefined): boolean {
    return !!url && this.allowedPayPalUrls.includes(url);
  }

  private validatePayPalApiBaseUrl(url: string): string {
    return this.isValidPayPalApiBaseUrl(url) ? url : 'https://api-m.sandbox.paypal.com';
  }

  private isTrustedPayPalCertUrl(url: string): boolean {
    try {
      const parsed = new URL(url);
      return (
        (parsed.hostname === 'api-m.paypal.com' || parsed.hostname === 'api-m.sandbox.paypal.com') &&
        parsed.pathname.startsWith('/v1/notifications/certs/')
      );
    } catch {
      return false;
    }
  }

  private mapPayPalAuthAlgo(algo: string): string {
    if (algo === 'SHA256withRSA') return 'RSA-SHA256';
    throw new Error(`Unsupported PayPal signature algorithm: ${algo}`);
  }

  private crc32(buffer: Buffer): string {
    const table = PaymentsService.crc32Table;
    let crc = -1;
    for (let i = 0; i < buffer.length; i++) {
      const byte = buffer.readUInt8(i);
      const idx = (crc ^ byte) & 0xff;
      crc = ((table[idx] ?? 0) ^ (crc >>> 8)) | 0;
    }
    return ((crc ^ -1) >>> 0).toString();
  }

  private static readonly crc32Table = (() => {
    const table = new Int32Array(256);
    for (let i = 0; i < 256; i++) {
      let c = i;
      for (let j = 0; j < 8; j++) {
        c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      }
      table[i] = c;
    }
    return table;
  })();

  private getPayPalHeader(
    headers: Record<string, string | string[] | undefined>,
    name: string
  ): string | undefined {
    const value = headers[name] ?? headers[name.toLowerCase()];
    return Array.isArray(value) ? value[0] : value;
  }

  async verifyPayPalWebhook(
    rawBody: Buffer,
    headers: Record<string, string | string[] | undefined>
  ): Promise<void> {
    const webhookId = this.configService.get<string>('PAYPAL_WEBHOOK_ID');
    if (!webhookId) {
      throw new Error('PayPal webhook ID is not configured.');
    }

    const transmissionId = this.getPayPalHeader(headers, 'paypal-transmission-id');
    const transmissionTime = this.getPayPalHeader(headers, 'paypal-transmission-time');
    const certUrl = this.getPayPalHeader(headers, 'paypal-cert-url');
    const authAlgo = this.getPayPalHeader(headers, 'paypal-auth-algo');
    const transmissionSig = this.getPayPalHeader(headers, 'paypal-transmission-sig');

    if (!transmissionId || !transmissionTime || !certUrl || !authAlgo || !transmissionSig) {
      throw new Error('Missing PayPal webhook signature headers.');
    }

    const eventTime = new Date(transmissionTime);
    const skewMs = Math.abs(Date.now() - eventTime.getTime());
    const MAX_SKEW_MS = 5 * 60 * 1000;
    if (Number.isNaN(eventTime.getTime()) || skewMs > MAX_SKEW_MS) {
      throw new Error('PayPal webhook transmission time is outside the allowed clock-skew window.');
    }

    if (!this.isTrustedPayPalCertUrl(certUrl)) {
      throw new Error('Untrusted PayPal certificate URL.');
    }

    const expectedSig = `${transmissionId}|${transmissionTime}|${webhookId}|${this.crc32(rawBody)}`;

    let certPem: string;
    try {
      const response = await fetch(certUrl, { signal: AbortSignal.timeout(PAYPAL_TIMEOUT_MS) });
      if (!response.ok) throw new Error('Failed to fetch PayPal certificate.');
      certPem = await response.text();
    } catch {
      throw new Error('Failed to fetch PayPal certificate.');
    }

    const algorithm = this.mapPayPalAuthAlgo(authAlgo);
    const verifier = crypto.createVerify(algorithm);
    verifier.update(expectedSig);
    verifier.end();

    const isValid = verifier.verify(certPem, transmissionSig, 'base64');
    if (!isValid) {
      throw new Error('PayPal webhook signature verification failed.');
    }

    const existing = await this.prisma.webhookEvent.findUnique({
      where: {
        provider_externalId: {
          provider: 'paypal',
          externalId: transmissionId
        }
      }
    });
    if (existing) {
      throw new Error(`Duplicate PayPal webhook transmission ${transmissionId} ignored.`);
    }

    let eventType: string;
    try {
      eventType = JSON.parse(rawBody.toString())?.event_type ?? 'unknown';
    } catch {
      eventType = 'unknown';
    }

    await this.prisma.webhookEvent.create({
      data: {
        provider: 'paypal',
        eventType,
        externalId: transmissionId,
        payloadHash: crypto.createHash('sha256').update(rawBody).digest('hex'),
        status: 'received'
      }
    });
  }

  extractPayPalMetadata(payload: any): Record<string, string> {
    const source = payload?.resource?.purchase_units?.[0]?.custom_id ?? payload?.purchase_units?.[0]?.custom_id;
    if (!source) return {};

    try {
      return JSON.parse(source) as Record<string, string>;
    } catch {
      return {};
    }
  }

  extractPayPalPaymentId(payload: any): string | null {
    return payload?.resource?.id ?? payload?.id ?? null;
  }
}
