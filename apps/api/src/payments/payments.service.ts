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
import type { UpdatePaymentSettingsDto } from './dto/update-payment-settings.dto.js';

const STRIPE_TIMEOUT_MS = 30_000;
const PAYPAL_TIMEOUT_MS = 30_000;

export type PaymentProvider = 'stripe' | 'paypal';

export type CheckoutUiMode = 'hosted' | 'embedded';

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
    return effective.stripePublishableKey ?? null;
  }

  async getCheckoutSession(sessionId: string) {
    const effective = await this.getEffectiveSettings();
    this.ensureStripeClient(effective.stripeSecretKey);
    this.ensureEnabled();

    const session = await this.stripe!.checkout.sessions.retrieve(sessionId, {
      expand: ['line_items']
    });

    return {
      id: session.id,
      status: session.status,
      amountTotal: session.amount_total ?? 0,
      currency: session.currency,
      metadata: session.metadata,
      customerEmail: session.customer_details?.email ?? session.customer_email ?? null,
      lineItems: session.line_items?.data.map((item) => ({
        description: item.description,
        amount: item.amount_total,
        quantity: item.quantity
      }))
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
    const feeResult = this.calculateProcessingFee(netAmount, effective);

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

    const isEmbedded = input.uiMode === 'embedded';

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
            ui_mode: 'embedded' as const,
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
