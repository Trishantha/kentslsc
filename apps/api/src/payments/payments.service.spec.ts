import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { PaymentsService } from './payments.service.js';

const mockConfig = {
  get: jest.fn((key: string) => {
    if (key === 'STRIPE_SECRET_KEY') return 'sk_test_123';
    if (key === 'PAYPAL_CLIENT_ID') return 'paypal-client-id';
    if (key === 'PAYPAL_CLIENT_SECRET') return 'paypal-client-secret';
    if (key === 'PAYPAL_API_BASE_URL') return 'https://api-m.sandbox.paypal.com';
    return undefined;
  })
};

describe('PaymentsService', () => {
  const originalFetch = global.fetch;
  const mockPrisma = {
    paymentSettings: {
      findFirst: jest.fn(async () => null)
    },
    user: {
      findUnique: jest.fn(),
      update: jest.fn()
    }
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('creates a PayPal checkout order when requested', async () => {
    global.fetch = jest.fn(async (url: string | URL | Request) => {
      const target = String(url);
      if (target.includes('/v1/oauth2/token')) {
        return {
          ok: true,
          json: async () => ({ access_token: 'pay-token' })
        } as Response;
      }

      if (target.includes('/v2/checkout/orders')) {
        return {
          ok: true,
          json: async () => ({
            id: 'paypal-order-123',
            links: [{ rel: 'approve', href: 'https://paypal.com/approve' }]
          })
        } as Response;
      }

      throw new Error(`Unexpected fetch target: ${target}`);
    }) as typeof fetch;

    const service = new PaymentsService(mockConfig as any, mockPrisma as any);
    const result = await service.createCheckout({
      provider: 'paypal',
      amount: 2500,
      currency: 'GBP',
      description: 'Membership upgrade',
      successUrl: 'https://example.com/success',
      cancelUrl: 'https://example.com/cancel',
      metadata: { source: 'membership', membershipTypeId: 'type-1' }
    });

    expect(result.provider).toBe('paypal');
    expect(result.id).toBe('paypal-order-123');
    expect(result.url).toBe('https://paypal.com/approve');
    expect(result.netAmount).toBe(2500);
    expect(result.processingFee).toBe(0);
    expect(result.grossAmount).toBe(2500);
  });

  describe('processing fee calculation', () => {
    it('calculates default Stripe UK fee (1.5% + 20p)', () => {
      const service = new PaymentsService(mockConfig as any, mockPrisma as any);
      const result = service.calculateProcessingFee(1000); // £10
      expect(result.net).toBe(1000);
      expect(result.fee).toBe(35); // 15p + 20p
      expect(result.gross).toBe(1035);
    });

    it('rounds fractional fee up to the next penny', () => {
      const service = new PaymentsService(mockConfig as any, mockPrisma as any);
      const result = service.calculateProcessingFee(1); // 1p
      expect(result.fee).toBe(21); // 0.015p rounds up, +20p
      expect(result.gross).toBe(22);
    });

    it('returns zero fee when disabled', () => {
      const service = new PaymentsService(mockConfig as any, mockPrisma as any);
      const result = service.calculateProcessingFee(1000, {
        processingFeeConfig: { enabled: false, percent: 1.5, fixed: 20 }
      } as any);
      expect(result.fee).toBe(0);
      expect(result.gross).toBe(1000);
    });
  });

  describe('createStripeCheckout', () => {
    it('adds a processing fee line item when fees are enabled', async () => {
      const service = new PaymentsService(mockConfig as any, mockPrisma as any);

      const createMock = jest.fn(async (params: any) => ({
        id: 'stripe-session-123',
        url: 'https://checkout.stripe.com/pay/session-123',
        client_secret: 'secret-123',
        ...params
      }));

      (service as any).stripe = {
        checkout: { sessions: { create: createMock } }
      };

      const result = await service.createCheckout({
        amount: 1000,
        currency: 'gbp',
        description: 'Test payment',
        successUrl: 'https://example.com/success',
        cancelUrl: 'https://example.com/cancel',
        metadata: { type: 'test' }
      });

      expect(result.provider).toBe('stripe');
      expect(result.netAmount).toBe(1000);
      expect(result.processingFee).toBe(35);
      expect(result.grossAmount).toBe(1035);

      const sessionParams = createMock.mock.calls[0]?.[0];
      if (!sessionParams) throw new Error('Expected checkout session params');
      expect(sessionParams.line_items).toHaveLength(2);
      expect(sessionParams.line_items[0].price_data.unit_amount).toBe(1000);
      expect(sessionParams.line_items[1].price_data.unit_amount).toBe(35);
      expect(sessionParams.line_items[1].price_data.product_data.name).toBe('Processing fee');
      expect(sessionParams.metadata.netAmount).toBe('1000');
      expect(sessionParams.metadata.processingFee).toBe('35');
      expect(sessionParams.metadata.grossAmount).toBe('1035');
    });

    it('creates a single line item when includeProcessingFee is false', async () => {
      const service = new PaymentsService(mockConfig as any, mockPrisma as any);

      const createMock = jest.fn(async (params: any) => ({
        id: 'stripe-session-789',
        url: 'https://checkout.stripe.com/pay/session-789',
        client_secret: 'secret-789',
        ...params
      }));

      (service as any).stripe = {
        checkout: { sessions: { create: createMock } }
      };

      const result = await service.createCheckout({
        amount: 1000,
        currency: 'gbp',
        description: 'Test payment',
        includeProcessingFee: false,
        successUrl: 'https://example.com/success',
        cancelUrl: 'https://example.com/cancel'
      });

      expect(result.provider).toBe('stripe');
      expect(result.netAmount).toBe(1000);
      expect(result.processingFee).toBe(0);
      expect(result.grossAmount).toBe(1000);

      const sessionParams = createMock.mock.calls[0]?.[0];
      if (!sessionParams) throw new Error('Expected checkout session params');
      expect(sessionParams.line_items).toHaveLength(1);
      expect(sessionParams.line_items[0].price_data.unit_amount).toBe(1000);
      expect(sessionParams.metadata.processingFee).toBe('0');
    });

    it('creates a single line item when fees are disabled', async () => {
      const service = new PaymentsService(mockConfig as any, {
        paymentSettings: {
          findFirst: jest.fn(async () => ({
            provider: 'stripe',
            processingFeeEnabled: false,
            processingFeePercent: 1.5,
            processingFeeFixed: 20
          }))
        }
      } as any);

      const createMock = jest.fn(async (params: any) => ({
        id: 'stripe-session-456',
        url: 'https://checkout.stripe.com/pay/session-456',
        client_secret: 'secret-456',
        ...params
      }));

      (service as any).stripe = {
        checkout: { sessions: { create: createMock } }
      };

      const result = await service.createCheckout({
        amount: 1000,
        currency: 'gbp',
        description: 'Test payment',
        successUrl: 'https://example.com/success',
        cancelUrl: 'https://example.com/cancel'
      });

      expect(result.processingFee).toBe(0);
      expect(result.grossAmount).toBe(1000);

      const sessionParams = createMock.mock.calls[0]?.[0];
      if (!sessionParams) throw new Error('Expected checkout session params');
      expect(sessionParams.line_items).toHaveLength(1);
      expect(sessionParams.line_items[0].price_data.unit_amount).toBe(1000);
    });

    it('uses a Stripe Customer id when provided and omits customer_email', async () => {
      const service = new PaymentsService(mockConfig as any, mockPrisma as any);

      const createMock = jest.fn(async (params: any) => ({
        id: 'stripe-session-789',
        url: 'https://checkout.stripe.com/pay/session-789',
        client_secret: 'secret-789',
        ...params
      }));

      (service as any).stripe = {
        checkout: { sessions: { create: createMock } }
      };

      await service.createCheckout({
        amount: 1000,
        currency: 'gbp',
        description: 'Test payment',
        customer: 'cus_test_123',
        successUrl: 'https://example.com/success',
        cancelUrl: 'https://example.com/cancel'
      });

      const sessionParams = createMock.mock.calls[0]?.[0];
      if (!sessionParams) throw new Error('Expected checkout session params');
      expect(sessionParams.customer).toBe('cus_test_123');
      expect(sessionParams.customer_email).toBeUndefined();
    });
  });

  describe('getOrCreateStripeCustomer', () => {
    it('reuses an existing stripeCustomerId', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({
        id: 'user-1',
        email: 'user@example.com',
        stripeCustomerId: 'cus_existing'
      });

      const service = new PaymentsService(mockConfig as any, mockPrisma as any);
      (service as any).stripe = { customers: { create: jest.fn() } };

      const result = await service.getOrCreateStripeCustomer('user-1', 'user@example.com');
      expect(result).toBe('cus_existing');
      expect((service as any).stripe.customers.create).not.toHaveBeenCalled();
    });

    it('creates and persists a new Stripe Customer when none exists', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({
        id: 'user-1',
        email: 'user@example.com',
        stripeCustomerId: null
      });
      mockPrisma.user.update.mockResolvedValue({ id: 'user-1' });

      const service = new PaymentsService(mockConfig as any, mockPrisma as any);
      (service as any).stripe = {
        customers: {
          create: jest.fn(async () => ({ id: 'cus_new' }))
        }
      };

      const result = await service.getOrCreateStripeCustomer('user-1', 'user@example.com');
      expect(result).toBe('cus_new');
      expect((service as any).stripe.customers.create).toHaveBeenCalledWith({
        email: 'user@example.com',
        metadata: { userId: 'user-1' }
      });
      expect(mockPrisma.user.update).toHaveBeenCalledWith({
        where: { id: 'user-1' },
        data: { stripeCustomerId: 'cus_new' }
      });
    });

    it('throws when the user is not found', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);

      const service = new PaymentsService(mockConfig as any, mockPrisma as any);
      (service as any).stripe = {};

      await expect(
        service.getOrCreateStripeCustomer('missing-user', 'user@example.com')
      ).rejects.toThrow('missing-user');
    });
  });

  describe('getCheckoutSession', () => {
    it('retrieves a Stripe checkout session with line items', async () => {
      const service = new PaymentsService(mockConfig as any, mockPrisma as any);
      (service as any).stripe = {
        checkout: {
          sessions: {
            retrieve: jest.fn(async () => ({
              id: 'cs_test_123',
              status: 'open',
              amount_total: 1035,
              currency: 'gbp',
              customer_details: { email: 'user@example.com' },
              metadata: { source: 'membership' },
              line_items: {
                data: [
                  { description: 'Membership', amount_total: 1000, quantity: 1 },
                  { description: 'Processing fee', amount_total: 35, quantity: 1 }
                ]
              }
            }))
          }
        }
      };

      const result = await service.getCheckoutSession('cs_test_123');
      expect(result.id).toBe('cs_test_123');
      expect(result.amountTotal).toBe(1035);
      expect(result.customerEmail).toBe('user@example.com');
      expect(result.lineItems).toHaveLength(2);
      expect(result.lineItems?.[1].description).toBe('Processing fee');
    });
  });

  describe('getSettings', () => {
    it('returns persisted processing fee settings', async () => {
      const customPrisma = {
        paymentSettings: {
          findFirst: jest.fn(async () => ({
            provider: 'stripe',
            processingFeeEnabled: true,
            processingFeePercent: 2.0,
            processingFeeFixed: 30
          }))
        }
      };
      const service = new PaymentsService(mockConfig as any, customPrisma as any);
      const settings = await service.getSettings();

      expect(settings.processingFeeEnabled).toBe(true);
      expect(settings.processingFeePercent).toBe(2.0);
      expect(settings.processingFeeFixed).toBe(30);
    });
  });

  describe('getPublicPaymentSettings', () => {
    it('returns provider and fee config without secrets', async () => {
      const service = new PaymentsService(mockConfig as any, mockPrisma as any);
      const settings = await service.getPublicPaymentSettings();

      expect(settings.provider).toBe('stripe');
      expect(settings.processingFeeEnabled).toBe(true);
      expect(settings.processingFeePercent).toBe(1.5);
      expect(settings.processingFeeFixed).toBe(20);
      expect(settings).not.toHaveProperty('hasStripeSecretKey');
    });
  });
});
