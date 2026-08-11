import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { PaymentsService } from './payments.service.js';

const mockConfig = {
  get: jest.fn((key: string) => {
    if (key === 'STRIPE_SECRET_KEY') return undefined;
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
  });
});
