import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import crypto from 'crypto';
import { GoCardlessService } from './gocardless.service.js';

const mockGoCardlessClient = {
  customers: {
    create: jest.fn<(params?: unknown) => Promise<{ id: string }>>(),
    find: jest.fn<(id: string) => Promise<{ id: string }>>()
  },
  billingRequests: {
    create: jest.fn<(params?: unknown) => Promise<{ id: string }>>(),
    find: jest.fn<(id: string) => Promise<{ id: string }>>()
  },
  billingRequestFlows: {
    create: jest.fn<(params?: unknown) => Promise<{ id: string; authorisation_url?: string }>>()
  },
  payments: { find: jest.fn<(id: string) => Promise<{ id: string; amount?: number }>>() },
  refunds: { create: jest.fn<(params?: unknown) => Promise<{ id: string }>>() },
  subscriptions: {
    find: jest.fn<(id: string) => Promise<{ id: string }>>(),
    cancel: jest.fn<(id: string) => Promise<{ id: string }>>()
  },
  instalmentSchedules: { find: jest.fn<(id: string) => Promise<{ id: string }>>() },
  mandates: {
    find: jest.fn<(id: string) => Promise<{ id: string }>>(),
    cancel: jest.fn<(id: string) => Promise<{ id: string }>>()
  }
};

jest.mock('gocardless-nodejs', () => ({
  GoCardlessClient: jest.fn().mockImplementation(() => mockGoCardlessClient),
  Environments: { Live: 'LIVE', Sandbox: 'SANDBOX' }
}));

function buildUser(overrides: Record<string, unknown> = {}) {
  return {
    id: 'user-1',
    email: 'Ada@Example.com',
    name: 'Ada Lovelace',
    firstName: 'Ada',
    lastName: 'Lovelace',
    gocardlessCustomerId: null,
    ...overrides
  };
}

function buildFlowInput(overrides: Record<string, unknown> = {}) {
  return {
    plan: 'one_off' as const,
    amountPence: 12000,
    description: 'Membership payment',
    metadata: { source: 'membership', membershipId: 'm-1' },
    redirectUri: 'https://example.com/pay/return',
    exitUri: 'https://example.com/pay/exit',
    ...overrides
  };
}

describe('GoCardlessService', () => {
  let service: GoCardlessService;
  const prisma = {
    paymentSettings: { findFirst: jest.fn() },
    user: { findUnique: jest.fn(), findFirst: jest.fn(), update: jest.fn() }
  } as any;

  const configService = {
    get: jest.fn()
  } as any;

  beforeEach(() => {
    jest.clearAllMocks();
    prisma.paymentSettings.findFirst.mockResolvedValue(null);
    configService.get.mockImplementation((key: string) =>
      key === 'GOCARDLESS_ACCESS_TOKEN' ? 'gc-token' : undefined
    );
    service = new GoCardlessService(configService, prisma);
  });

  describe('verifyWebhookSignature', () => {
    const secret = 'whsec_test';
    const body = Buffer.from(JSON.stringify({ events: [{ id: 'EV123' }] }));

    function sign(payload: Buffer, key: string): string {
      return crypto.createHmac('sha256', key).update(payload).digest('hex');
    }

    it('accepts a valid signature', () => {
      expect(service.verifyWebhookSignature(body, sign(body, secret), secret)).toBe(true);
    });

    it('rejects a signature made with a different secret', () => {
      expect(service.verifyWebhookSignature(body, sign(body, 'other-secret'), secret)).toBe(false);
    });

    it('rejects a valid signature when the body was tampered with', () => {
      const tampered = Buffer.from(body.toString().replace('EV123', 'EV456'));
      expect(service.verifyWebhookSignature(tampered, sign(body, secret), secret)).toBe(false);
    });

    it('rejects a malformed signature header', () => {
      expect(service.verifyWebhookSignature(body, 'not-hex', secret)).toBe(false);
      expect(service.verifyWebhookSignature(body, '', secret)).toBe(false);
    });
  });

  describe('settings resolution', () => {
    it('reports configured when an access token is present', async () => {
      expect(await service.isConfigured()).toBe(true);
    });

    it('reports not configured when no access token is set', async () => {
      configService.get.mockReturnValue(undefined);
      expect(await service.isConfigured()).toBe(false);
    });

    it('reports configured when only a persisted token exists (no env token)', async () => {
      configService.get.mockReturnValue(undefined);
      prisma.paymentSettings.findFirst.mockResolvedValue({
        gocardlessAccessToken: 'persisted-token',
        gocardlessWebhookSecret: null,
        gocardlessEnvironment: null
      });

      expect(await service.isConfigured()).toBe(true);
    });

    it('uses the environment token when the persisted credential is blank', async () => {
      prisma.paymentSettings.findFirst.mockResolvedValue({ gocardlessAccessToken: '   ' });

      expect(await service.isConfigured()).toBe(true);
    });

    it('throws a helpful error when creating a flow without credentials', async () => {
      configService.get.mockReturnValue(undefined);
      await expect(service.createBillingRequestFlow(buildFlowInput())).rejects.toThrow(
        /GoCardless is not configured/
      );
    });

    it('blocks new flows when the platform is disabled, even with credentials', async () => {
      prisma.paymentSettings.findFirst.mockResolvedValue({ gocardlessEnabled: false });

      await expect(service.createBillingRequestFlow(buildFlowInput())).rejects.toThrow(
        /GoCardless payments are currently disabled/
      );
    });

    it('still exposes the webhook secret when the platform is disabled', async () => {
      prisma.paymentSettings.findFirst.mockResolvedValue({
        gocardlessWebhookSecret: 'whsec_persisted',
        gocardlessEnabled: false
      });

      await expect(service.getWebhookSecret()).resolves.toBe('whsec_persisted');
    });

    it('prefers persisted PaymentSettings over environment variables', async () => {
      prisma.paymentSettings.findFirst.mockResolvedValue({
        gocardlessAccessToken: 'persisted-token',
        gocardlessWebhookSecret: null,
        gocardlessEnvironment: null
      });
      prisma.user.findUnique.mockResolvedValue(buildUser({ gocardlessCustomerId: 'CU_existing' }));

      await service.getOrCreateCustomer('user-1');

      const { GoCardlessClient } = jest.requireMock('gocardless-nodejs') as any;
      expect(GoCardlessClient).toHaveBeenCalledWith('persisted-token', 'SANDBOX');
      // Existing customer id is returned without calling the API.
      expect(mockGoCardlessClient.customers.create).not.toHaveBeenCalled();
    });

    it('recreates the client when payment settings rotate credentials or environment', async () => {
      prisma.user.findUnique.mockResolvedValue(buildUser({ gocardlessCustomerId: 'CU_existing' }));

      await service.getOrCreateCustomer('user-1');

      prisma.paymentSettings.findFirst.mockResolvedValue({
        gocardlessAccessToken: 'rotated-token',
        gocardlessEnvironment: 'live'
      });
      await service.getOrCreateCustomer('user-1');

      const { GoCardlessClient, Environments } = jest.requireMock('gocardless-nodejs') as any;
      expect(GoCardlessClient).toHaveBeenNthCalledWith(1, 'gc-token', Environments.Sandbox);
      expect(GoCardlessClient).toHaveBeenNthCalledWith(2, 'rotated-token', Environments.Live);
    });
  });

  describe('getOrCreateCustomer', () => {
    it('returns the persisted customer id without calling GoCardless', async () => {
      prisma.user.findUnique.mockResolvedValue(buildUser({ gocardlessCustomerId: 'CU_existing' }));

      const id = await service.getOrCreateCustomer('user-1');

      expect(id).toBe('CU_existing');
      expect(mockGoCardlessClient.customers.create).not.toHaveBeenCalled();
    });

    it('creates a customer from the user record and persists the id', async () => {
      prisma.user.findUnique.mockResolvedValue(buildUser());
      mockGoCardlessClient.customers.create.mockResolvedValue({ id: 'CU_new' });
      prisma.user.update.mockResolvedValue({});

      const id = await service.getOrCreateCustomer('user-1');

      expect(id).toBe('CU_new');
      expect(mockGoCardlessClient.customers.create).toHaveBeenCalledWith({
        email: 'ada@example.com',
        given_name: 'Ada',
        family_name: 'Lovelace',
        metadata: { userId: 'user-1' }
      });
      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: 'user-1' },
        data: { gocardlessCustomerId: 'CU_new' }
      });
    });

    it('throws when the user does not exist', async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      await expect(service.getOrCreateCustomer('missing')).rejects.toThrow(/not found/);
    });
  });

  describe('createBillingRequestFlow', () => {
    beforeEach(() => {
      mockGoCardlessClient.billingRequests.create.mockResolvedValue({ id: 'BR123' });
      mockGoCardlessClient.billingRequestFlows.create.mockResolvedValue({
        id: 'BRF123',
        authorisation_url: 'https://pay.gocardless.com/flow/BRF123'
      });
    });

    it('creates a bacs one-off with a no-verification mandate alongside the payment request', async () => {
      const result = await service.createBillingRequestFlow(buildFlowInput({ scheme: 'bacs' }));

      expect(mockGoCardlessClient.billingRequests.create).toHaveBeenCalledWith(
        expect.objectContaining({
          metadata: { source: 'membership', data: '{"membershipId":"m-1"}' },
          payment_request: {
            amount: '12000',
            currency: 'GBP',
            description: 'Membership payment',
            scheme: 'bacs'
          },
          mandate_request: { scheme: 'bacs', verify: 'minimum' }
        })
      );
      expect(result).toEqual({
        provider: 'gocardless',
        id: 'BR123',
        url: 'https://pay.gocardless.com/flow/BRF123'
      });
    });

    it('omits the mandate request for faster_payments one-offs', async () => {
      await service.createBillingRequestFlow(buildFlowInput({ scheme: 'faster_payments' }));

      const request = mockGoCardlessClient.billingRequests.create.mock.calls[0]![0] as any;
      expect(request.payment_request.scheme).toBe('faster_payments');
      expect(request.mandate_request).toBeUndefined();
    });

    it('creates a subscription with a bacs mandate and monthly interval', async () => {
      await service.createBillingRequestFlow(
        buildFlowInput({
          plan: 'subscription',
          subscriptionIntervalUnit: 'monthly',
          subscriptionInterval: 1
        })
      );

      expect(mockGoCardlessClient.billingRequests.create).toHaveBeenCalledWith(
        expect.objectContaining({
          mandate_request: { scheme: 'bacs' },
          subscription_request: expect.objectContaining({
            amount: '12000',
            currency: 'GBP',
            interval: '1',
            interval_unit: 'monthly'
          })
        })
      );
    });

    it('creates instalments whose monthly amounts sum exactly to the total', async () => {
      await service.createBillingRequestFlow(
        buildFlowInput({ plan: 'instalments', amountPence: 10000, instalmentCount: 3 })
      );

      const request = mockGoCardlessClient.billingRequests.create.mock.calls[0]![0] as any;
      expect(request.instalment_schedule_request).toEqual(
        expect.objectContaining({
          total_amount: '10000',
          currency: 'GBP',
          instalments_with_schedule: {
            amounts: ['3333', '3333', '3334'],
            interval: 1,
            interval_unit: 'monthly'
          }
        })
      );
    });

    it('creates the flow against the billing request with redirect and exit URIs', async () => {
      await service.createBillingRequestFlow(buildFlowInput());

      expect(mockGoCardlessClient.billingRequestFlows.create).toHaveBeenCalledWith(
        expect.objectContaining({
          links: { billing_request: 'BR123' },
          redirect_uri: 'https://example.com/pay/return',
          exit_uri: 'https://example.com/pay/exit'
        })
      );
    });

    it('prefills payer details when a customer id is provided', async () => {
      prisma.user.findFirst.mockResolvedValue(buildUser());

      await service.createBillingRequestFlow(buildFlowInput({ customerId: 'CU_1' }));

      const flowRequest = mockGoCardlessClient.billingRequestFlows.create.mock.calls[0]![0] as any;
      expect(flowRequest.prefilled_customer).toEqual(
        expect.objectContaining({ email: 'Ada@Example.com', given_name: 'Ada' })
      );
      const billingRequest = mockGoCardlessClient.billingRequests.create.mock.calls[0]![0] as any;
      expect(billingRequest.links).toEqual({ customer: 'CU_1' });
    });
  });

  describe('refundPayment', () => {
    it('refunds in full by confirming the original payment amount', async () => {
      mockGoCardlessClient.payments.find.mockResolvedValue({ id: 'PM123', amount: 12000 });
      mockGoCardlessClient.refunds.create.mockResolvedValue({ id: 'RF123' });

      await service.refundPayment('PM123');

      expect(mockGoCardlessClient.refunds.create).toHaveBeenCalledWith({
        amount: '12000',
        total_amount_confirmation: '12000',
        links: { payment: 'PM123' }
      });
    });

    it('refunds a partial amount', async () => {
      mockGoCardlessClient.refunds.create.mockResolvedValue({ id: 'RF124' });

      await service.refundPayment('PM123', 5000);

      expect(mockGoCardlessClient.refunds.create).toHaveBeenCalledWith({
        amount: '5000',
        total_amount_confirmation: '5000',
        links: { payment: 'PM123' }
      });
      expect(mockGoCardlessClient.payments.find).not.toHaveBeenCalled();
    });
  });

  describe('retrieve and cancel wrappers', () => {
    it('delegates to the matching resource service', async () => {
      await service.getBillingRequest('BR1');
      expect(mockGoCardlessClient.billingRequests.find).toHaveBeenCalledWith('BR1');

      await service.getPayment('PM1');
      expect(mockGoCardlessClient.payments.find).toHaveBeenCalledWith('PM1');

      await service.getSubscription('SB1');
      expect(mockGoCardlessClient.subscriptions.find).toHaveBeenCalledWith('SB1');

      await service.getInstalmentSchedule('IS1');
      expect(mockGoCardlessClient.instalmentSchedules.find).toHaveBeenCalledWith('IS1');

      await service.getMandate('MD1');
      expect(mockGoCardlessClient.mandates.find).toHaveBeenCalledWith('MD1');

      await service.cancelMandate('MD1');
      expect(mockGoCardlessClient.mandates.cancel).toHaveBeenCalledWith('MD1');

      await service.cancelSubscription('SB1');
      expect(mockGoCardlessClient.subscriptions.cancel).toHaveBeenCalledWith('SB1');
    });
  });
});
