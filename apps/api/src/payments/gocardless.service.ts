import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import crypto from 'crypto';
import { GoCardlessClient, Environments } from 'gocardless-nodejs';
import type {
  BillingRequestMandateRequestVerify,
  BillingRequest as GCBillingRequest,
  Payment as GCPayment,
  Subscription as GCSubscription,
  InstalmentSchedule as GCInstalmentSchedule,
  Mandate as GCMandate,
  Refund as GCRefund
} from 'gocardless-nodejs';
import { PrismaService } from '../core/prisma/prisma.service.js';

export type GoCardlessPlanType = 'one_off' | 'subscription' | 'instalments';
export type GoCardlessPaymentScheme = 'bacs' | 'faster_payments';

export interface CreateGoCardlessBillingRequestFlowInput {
  plan: GoCardlessPlanType;
  /** Total amount in pence. GoCardless amounts are strings in minor units. */
  amountPence: number;
  description: string;
  metadata: Record<string, string>;
  redirectUri: string;
  exitUri: string;
  scheme?: GoCardlessPaymentScheme;
  /** Number of monthly instalments. Only used for the instalments plan. */
  instalmentCount?: number;
  /** GoCardless Customer id (CU...). Prefills payer details in the flow. */
  customerId?: string;
  subscriptionIntervalUnit?: 'monthly' | 'yearly';
  subscriptionInterval?: number;
}

export interface GoCardlessBillingRequestFlowResult {
  provider: 'gocardless';
  /** The Billing Request id (BR...), the reference recorded on the Payment ledger. */
  id: string;
  /** The Billing Request Flow authorisation URL to redirect the payer to. */
  url: string;
}

interface GoCardlessSettings {
  accessToken?: string;
  webhookSecret?: string;
  environment: 'sandbox' | 'live';
}

@Injectable()
export class GoCardlessService {
  private readonly logger = new Logger(GoCardlessService.name);
  private client?: GoCardlessClient;

  constructor(
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService
  ) {}

  private async getEffectiveSettings(): Promise<GoCardlessSettings> {
    const persisted = await this.prisma.paymentSettings.findFirst();

    return {
      accessToken:
        persisted?.gocardlessAccessToken ??
        this.configService.get<string>('GOCARDLESS_ACCESS_TOKEN') ??
        undefined,
      webhookSecret:
        persisted?.gocardlessWebhookSecret ??
        this.configService.get<string>('GOCARDLESS_WEBHOOK_SECRET') ??
        undefined,
      environment: this.resolveEnvironment(
        persisted?.gocardlessEnvironment ?? this.configService.get<string>('GOCARDLESS_ENVIRONMENT')
      )
    };
  }

  private resolveEnvironment(value: string | null | undefined): 'sandbox' | 'live' {
    return value === 'live' ? 'live' : 'sandbox';
  }

  private ensureClient(settings: GoCardlessSettings) {
    if (!settings.accessToken) {
      this.client = undefined;
      return;
    }

    if (!this.client) {
      this.client = new GoCardlessClient(
        settings.accessToken,
        settings.environment === 'live' ? Environments.Live : Environments.Sandbox
      );
    }
  }

  private ensureEnabled() {
    if (!this.client) {
      throw new Error(
        'GoCardless is not configured. Set GOCARDLESS_ACCESS_TOKEN to enable GoCardless payments.'
      );
    }
  }

  private async getClient(): Promise<GoCardlessClient> {
    const settings = await this.getEffectiveSettings();
    this.ensureClient(settings);
    this.ensureEnabled();
    return this.client!;
  }

  isConfigured(): boolean {
    return !!this.configService.get<string>('GOCARDLESS_ACCESS_TOKEN');
  }

  getWebhookSecret(): Promise<string | undefined> {
    return this.getEffectiveSettings().then((settings) => settings.webhookSecret);
  }

  /**
   * Get an existing GoCardless Customer id for a user, or create one and persist it.
   * Linking a customer to a Billing Request Flow prefills the payer's details so
   * they cannot be entered differently, preventing reconciliation errors.
   */
  async getOrCreateCustomer(userId: string): Promise<string> {
    const client = await this.getClient();

    const user = await this.prisma.user.findUnique({
      where: { id: userId, deletedAt: null },
      select: {
        id: true,
        email: true,
        name: true,
        firstName: true,
        lastName: true,
        gocardlessCustomerId: true
      }
    });
    if (!user) {
      throw new Error(`Cannot create GoCardless customer: user ${userId} not found`);
    }

    if (user.gocardlessCustomerId) {
      return user.gocardlessCustomerId;
    }

    const nameParts = user.name.trim().split(/\s+/);
    const customer = await client.customers.create({
      email: user.email.toLowerCase().trim(),
      given_name: user.firstName ?? nameParts[0],
      family_name: user.lastName ?? (nameParts.slice(1).join(' ') || undefined),
      metadata: { userId: user.id }
    });

    try {
      await this.prisma.user.update({
        where: { id: userId },
        data: { gocardlessCustomerId: customer.id }
      });
    } catch (err) {
      this.logger.warn(
        `Failed to persist gocardlessCustomerId ${customer.id} for user ${userId}: ${(err as Error).message}`
      );
    }

    if (!customer.id) {
      throw new Error(`GoCardless did not return a customer id for user ${userId}`);
    }
    return customer.id;
  }

  /**
   * Create a Billing Request for the plan and wrap it in a Billing Request Flow,
   * returning the hosted authorisation URL the payer is redirected to. GoCardless
   * has no hosted checkout page of its own; the flow collects bank details and
   * authorisation, then sends the payer back to redirect_uri.
   */
  async createBillingRequestFlow(
    input: CreateGoCardlessBillingRequestFlowInput
  ): Promise<GoCardlessBillingRequestFlowResult> {
    const client = await this.getClient();
    const amount = String(input.amountPence);

    const request: Parameters<GoCardlessClient['billingRequests']['create']>[0] = {
      metadata: input.metadata,
      ...(input.customerId ? { links: { customer: input.customerId } } : {})
    };

    switch (input.plan) {
      case 'one_off': {
        const scheme = input.scheme ?? 'bacs';
        request.payment_request = {
          amount,
          currency: 'GBP',
          description: input.description,
          scheme
        };
        // BACS one-off payments are collected against a mandate, but the payer
        // should not be charged a penny verification payment on top of the
        // payment itself. Faster Payments (Instant Bank Pay) needs no mandate.
        if (scheme === 'bacs') {
          request.mandate_request = {
            scheme: 'bacs',
            verify: 'never' as `${BillingRequestMandateRequestVerify}`
          };
        }
        break;
      }
      case 'subscription':
        request.mandate_request = { scheme: 'bacs' };
        request.subscription_request = {
          amount,
          currency: 'GBP',
          interval: String(input.subscriptionInterval ?? 1),
          interval_unit: input.subscriptionIntervalUnit ?? 'monthly',
          name: input.description,
          metadata: input.metadata
        };
        break;
      case 'instalments': {
        request.mandate_request = { scheme: 'bacs' };
        const count = Math.max(1, input.instalmentCount ?? 1);
        const baseAmount = Math.floor(input.amountPence / count);
        // Give the final instalment the remainder so the instalments always
        // sum exactly to the requested total.
        const amounts = Array.from({ length: count }, (_, index) =>
          String(index === count - 1 ? input.amountPence - baseAmount * (count - 1) : baseAmount)
        );
        request.instalment_schedule_request = {
          total_amount: amount,
          currency: 'GBP',
          name: input.description,
          metadata: input.metadata,
          instalments_with_schedule: {
            amounts,
            interval: 1,
            interval_unit: 'monthly'
          }
        };
        break;
      }
    }

    const billingRequest = await client.billingRequests.create(request);

    const prefilledCustomer = input.customerId
      ? await this.buildPrefilledCustomer(input.customerId)
      : undefined;

    const flow = await client.billingRequestFlows.create({
      links: { billing_request: billingRequest.id },
      // The billing request id only exists once GoCardless has created it, so
      // callers embed the `{BILLING_REQUEST_ID}` placeholder and it is
      // substituted here — the GoCardless equivalent of Stripe's
      // `{CHECKOUT_SESSION_ID}` in success URLs.
      redirect_uri: input.redirectUri.replace('{BILLING_REQUEST_ID}', billingRequest.id),
      exit_uri: input.exitUri,
      ...(prefilledCustomer ? { prefilled_customer: prefilledCustomer } : {})
    });

    return {
      provider: 'gocardless',
      id: billingRequest.id,
      url: flow.authorisation_url ?? ''
    };
  }

  private async buildPrefilledCustomer(customerId: string) {
    const user = await this.prisma.user.findFirst({
      where: { gocardlessCustomerId: customerId, deletedAt: null },
      select: { email: true, firstName: true, lastName: true, name: true }
    });
    if (!user) return undefined;

    const nameParts = user.name.trim().split(/\s+/);
    return {
      email: user.email,
      given_name: user.firstName ?? nameParts[0],
      family_name: user.lastName ?? (nameParts.slice(1).join(' ') || null)
    };
  }

  async getBillingRequest(id: string): Promise<GCBillingRequest> {
    const client = await this.getClient();
    return client.billingRequests.find(id);
  }

  async getPayment(id: string): Promise<GCPayment> {
    const client = await this.getClient();
    return client.payments.find(id);
  }

  async getSubscription(id: string): Promise<GCSubscription> {
    const client = await this.getClient();
    return client.subscriptions.find(id);
  }

  async getInstalmentSchedule(id: string): Promise<GCInstalmentSchedule> {
    const client = await this.getClient();
    return client.instalmentSchedules.find(id);
  }

  async getMandate(id: string): Promise<GCMandate> {
    const client = await this.getClient();
    return client.mandates.find(id);
  }

  async cancelMandate(id: string): Promise<GCMandate> {
    const client = await this.getClient();
    return client.mandates.cancel(id);
  }

  async cancelSubscription(id: string): Promise<GCSubscription> {
    const client = await this.getClient();
    return client.subscriptions.cancel(id);
  }

  /**
   * Refund a payment, in full by default. GoCardless requires the amount and a
   * total_amount_confirmation matching the original payment amount, so a full
   * refund first retrieves the payment.
   */
  async refundPayment(paymentId: string, amountPence?: number): Promise<GCRefund> {
    const client = await this.getClient();

    let totalAmount = amountPence;
    if (totalAmount === undefined) {
      const payment = await client.payments.find(paymentId);
      totalAmount = Number(payment.amount);
    }

    return client.refunds.create({
      amount: String(amountPence ?? totalAmount),
      total_amount_confirmation: String(totalAmount),
      links: { payment: paymentId }
    });
  }

  /**
   * Verify the Webhook-Signature header on an incoming GoCardless webhook. The
   * header is a SHA-256 HMAC (hex digest) of the raw request body keyed by the
   * webhook endpoint secret. Mirrors the official client library's
   * webhooks.verifySignature so verification can return a boolean here.
   */
  verifyWebhookSignature(rawBody: Buffer, signatureHeader: string, secret: string): boolean {
    const digest = crypto.createHmac('sha256', secret).update(rawBody).digest();
    const signature = Buffer.from(signatureHeader, 'hex');

    if (signature.length !== digest.length) {
      return false;
    }
    return crypto.timingSafeEqual(digest, signature);
  }
}
