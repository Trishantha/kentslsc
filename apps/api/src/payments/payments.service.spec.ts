import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import crypto from 'crypto';
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
  const mockPrisma: any = {
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
    it('returns full details for the session owner', async () => {
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
              payment_intent: 'pi_test_123',
              metadata: { source: 'membership', userId: 'user-1' },
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

      const result = await service.getCheckoutSession('cs_test_123', 'user-1');
      expect(result.id).toBe('cs_test_123');
      expect(result.amountTotal).toBe(1035);
      expect(result.customerEmail).toBe('user@example.com');
      expect(result.paymentIntentId).toBe('pi_test_123');
      expect(result.metadata).toEqual({ source: 'membership', userId: 'user-1' });
      expect(result.lineItems).toHaveLength(2);
      expect(result.lineItems?.[1]?.description).toBe('Processing fee');
    });

    it('redacts sensitive fields for anonymous sessions', async () => {
      const service = new PaymentsService(mockConfig as any, mockPrisma as any);
      (service as any).stripe = {
        checkout: {
          sessions: {
            retrieve: jest.fn(async () => ({
              id: 'cs_test_456',
              status: 'open',
              amount_total: 1035,
              currency: 'gbp',
              customer_details: { email: 'anon@example.com' },
              payment_intent: 'pi_test_456',
              metadata: { source: 'donation' },
              line_items: {
                data: [
                  { description: 'Donation', amount_total: 1000, quantity: 1 },
                  { description: 'Processing fee', amount_total: 35, quantity: 1 }
                ]
              }
            }))
          }
        }
      };

      const result = await service.getCheckoutSession('cs_test_456');
      expect(result.id).toBe('cs_test_456');
      expect(result.amountTotal).toBe(1035);
      expect(result.customerEmail).toBeNull();
      expect(result.paymentIntentId).toBeNull();
      expect(result.metadata).toBeNull();
      expect(result.lineItems).toHaveLength(2);
    });

    it('redacts sensitive fields when the caller is not the owner', async () => {
      const service = new PaymentsService(mockConfig as any, mockPrisma as any);
      (service as any).stripe = {
        checkout: {
          sessions: {
            retrieve: jest.fn(async () => ({
              id: 'cs_test_789',
              status: 'open',
              amount_total: 1035,
              currency: 'gbp',
              customer_details: { email: 'user@example.com' },
              payment_intent: 'pi_test_789',
              metadata: { source: 'membership', userId: 'user-1' },
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

      const result = await service.getCheckoutSession('cs_test_789', 'user-2');
      expect(result.id).toBe('cs_test_789');
      expect(result.customerEmail).toBeNull();
      expect(result.paymentIntentId).toBeNull();
      expect(result.metadata).toBeNull();
      expect(result.lineItems).toHaveLength(2);
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

  describe('getStripePublishableKey', () => {
    it('returns the publishable key from environment', async () => {
      const customConfig = {
        get: jest.fn((key: string) => {
          if (key === 'STRIPE_PUBLISHABLE_KEY') return 'pk_test_456';
          return undefined;
        })
      };
      const service = new PaymentsService(customConfig as any, mockPrisma as any);
      const key = await service.getStripePublishableKey();
      expect(key).toBe('pk_test_456');
    });

    it('returns null when a secret key is configured as the publishable key', async () => {
      const customConfig = {
        get: jest.fn((key: string) => {
          if (key === 'STRIPE_PUBLISHABLE_KEY') return 'sk_test_456';
          return undefined;
        })
      };
      const service = new PaymentsService(customConfig as any, mockPrisma as any);
      const key = await service.getStripePublishableKey();
      expect(key).toBeNull();
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

  describe('subscription helpers', () => {
    it('syncMembershipTypePrice creates a product and price when none exist', async () => {
      const service = new PaymentsService(mockConfig as any, mockPrisma as any);
      const productsSearchMock = (jest.fn() as jest.Mock<(...args: any[]) => Promise<any>>).mockResolvedValue({ data: [] });
      const productCreateMock = (jest.fn() as jest.Mock<(...args: any[]) => Promise<any>>).mockResolvedValue({ id: 'prod_test' });
      const pricesListMock = (jest.fn() as jest.Mock<(...args: any[]) => Promise<any>>).mockResolvedValue({ data: [] });
      const priceCreateMock = (jest.fn() as jest.Mock<(...args: any[]) => Promise<any>>).mockResolvedValue({ id: 'price_test' });

      (service as any).stripe = {
        products: {
          search: productsSearchMock,
          create: productCreateMock
        },
        prices: {
          list: pricesListMock,
          create: priceCreateMock
        }
      };

      const result = await service.syncMembershipTypePrice({
        id: 'type-1',
        name: 'Annual Membership',
        price: 10,
        durationMonths: 12
      });

      expect(result.productId).toBe('prod_test');
      expect(result.priceId).toBe('price_test');
      expect(productCreateMock).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'Annual Membership',
          metadata: { membershipTypeId: 'type-1' }
        })
      );
      expect(priceCreateMock).toHaveBeenCalledWith(
        expect.objectContaining({
          product: 'prod_test',
          unit_amount: 1000,
          currency: 'gbp',
          recurring: { interval: 'month', interval_count: 12 }
        })
      );
    });

    it('createSubscriptionCheckout creates a subscription mode session', async () => {
      const service = new PaymentsService(mockConfig as any, mockPrisma as any);
      const createMock = (jest.fn() as jest.Mock<(...args: any[]) => Promise<any>>).mockResolvedValue({
        id: 'cs_sub_123',
        url: 'https://checkout.stripe.test/sub',
        client_secret: 'cs_sub_secret'
      });

      (service as any).stripe = {
        checkout: { sessions: { create: createMock } }
      };

      const result = await service.createSubscriptionCheckout({
        priceId: 'price_test',
        customer: 'cus_test',
        successUrl: 'https://example.com/success',
        cancelUrl: 'https://example.com/cancel',
        metadata: { source: 'membership' }
      });

      expect(result.id).toBe('cs_sub_123');
      expect(result.url).toBe('https://checkout.stripe.test/sub');
      const params = createMock.mock.calls[0]?.[0] as any;
      expect(params.mode).toBe('subscription');
      expect(params.line_items).toEqual([{ price: 'price_test', quantity: 1 }]);
      expect(params.customer).toBe('cus_test');
    });

    it('createBillingPortalSession returns a portal URL', async () => {
      const service = new PaymentsService(mockConfig as any, mockPrisma as any);
      const createMock = (jest.fn() as jest.Mock<(...args: any[]) => Promise<any>>).mockResolvedValue({ url: 'https://billing.stripe.test/session' });

      (service as any).stripe = {
        billingPortal: { sessions: { create: createMock } }
      };

      const url = await service.createBillingPortalSession('cus_test', 'https://example.com/return');

      expect(url).toBe('https://billing.stripe.test/session');
      expect(createMock).toHaveBeenCalledWith(
        expect.objectContaining({
          customer: 'cus_test',
          return_url: 'https://example.com/return'
        })
      );
    });
  });

  describe('refund helpers', () => {
    it('refundStripePaymentIntent creates a full refund by default', async () => {
      const service = new PaymentsService(mockConfig as any, mockPrisma as any);
      const refundsCreate = (jest.fn() as jest.Mock<(...args: any[]) => Promise<any>>).mockResolvedValue({ id: 're_123', status: 'succeeded' });
      (service as any).stripe = { refunds: { create: refundsCreate } };

      const result = await service.refundStripePaymentIntent('pi_123');

      expect(result.providerRefundId).toBe('re_123');
      expect(result.status).toBe('succeeded');
      expect(refundsCreate).toHaveBeenCalledWith({ payment_intent: 'pi_123' });
    });

    it('refundStripePaymentIntent creates a partial refund when amount is provided', async () => {
      const service = new PaymentsService(mockConfig as any, mockPrisma as any);
      const refundsCreate = (jest.fn() as jest.Mock<(...args: any[]) => Promise<any>>).mockResolvedValue({ id: 're_partial', status: 'succeeded' });
      (service as any).stripe = { refunds: { create: refundsCreate }};

      await service.refundStripePaymentIntent('pi_123', 500, 'duplicate');

      expect(refundsCreate).toHaveBeenCalledWith({
        payment_intent: 'pi_123',
        amount: 500,
        reason: 'requested_by_customer'
      });
    });

    it('refundPayPalCapture calls the PayPal refund endpoint', async () => {
      const service = new PaymentsService(mockConfig as any, mockPrisma as any);
      global.fetch = jest.fn(async (url: string | URL | Request) => {
        const target = String(url);
        if (target.includes('/v1/oauth2/token')) {
          return { ok: true, json: async () => ({ access_token: 'pay-token' }) } as Response;
        }
        if (target.includes('/v2/payments/captures/CAPTURE-1/refund')) {
          return { ok: true, json: async () => ({ id: 'REFUND-1', status: 'COMPLETED' }) } as Response;
        }
        throw new Error(`Unexpected fetch target: ${target}`);
      }) as typeof fetch;

      const result = await service.refundPayPalCapture('CAPTURE-1', 1000, 'GBP');

      expect(result.providerRefundId).toBe('REFUND-1');
      expect(result.status).toBe('COMPLETED');
    });
  });

  describe('syncStripeRevenue', () => {
    it('creates missing Payment rows from completed Stripe sessions', async () => {
      const prismaWithNoPayments = {
        ...mockPrisma,
        payment: {
          findFirst: jest.fn(() => Promise.resolve(null)) as any,
          create: jest.fn(() => Promise.resolve({ id: 'pay-new' })) as any
        }
      };

      const service = new PaymentsService(mockConfig as any, prismaWithNoPayments as any);
      (service as any).stripe = {
        checkout: {
          sessions: {
            list: jest.fn(async () => ({
              data: [
                {
                  id: 'cs_test_123',
                  payment_status: 'paid',
                  status: 'complete',
                  amount_total: 1035,
                  currency: 'gbp',
                  created: Math.floor(Date.now() / 1000),
                  metadata: { type: 'event_ticket', eventId: 'event-1', userId: 'user-1' },
                  payment_intent: 'pi_test_123',
                  payment_method_types: ['card'],
                  customer_details: {
                    name: 'Jane Doe',
                    email: 'jane@example.com',
                    phone: '01234567890',
                    address: {
                      line1: '1 The Street',
                      line2: null,
                      city: 'London',
                      postal_code: 'SW1A 1AA',
                      country: 'GB'
                    }
                  }
                }
              ],
              has_more: false
            }))
          }
        },
        paymentIntents: {
          retrieve: jest.fn(async () => ({
            id: 'pi_test_123',
            latest_charge: {
              id: 'ch_test_123',
              balance_transaction: {
                id: 'bt_test_123',
                fee: 35,
                net: 1000
              }
            }
          }))
        },
        refunds: {
          list: jest.fn(async () => ({ data: [] }))
        }
      };

      const result = await service.syncStripeRevenue();

      expect(result.created).toBe(1);
      expect(result.updated).toBe(0);
      expect(prismaWithNoPayments.payment.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            providerCheckoutId: 'cs_test_123',
            providerPaymentId: 'pi_test_123',
            paymentChannel: 'stripe',
            paymentStatus: 'COMPLETED',
            grossAmount: 10.35,
            processingFee: 0.35,
            netAmount: 10,
            currency: 'GBP',
            sourceType: 'TICKET',
            eventId: 'event-1',
            userId: 'user-1'
          })
        })
      );
    });

    it('updates existing Payment rows with actual Stripe fees and refunds', async () => {
      const prismaWithExistingPayment = {
        ...mockPrisma,
        payment: {
          findFirst: jest.fn(() =>
            Promise.resolve({
              id: 'pay-existing',
              providerPaymentId: 'pi_test_123',
              paymentStatus: 'COMPLETED',
              refundedAmount: null,
              grossAmount: 10.35
            })
          ) as any,
          update: jest.fn(() => Promise.resolve({ id: 'pay-existing' })) as any
        }
      };

      const service = new PaymentsService(mockConfig as any, prismaWithExistingPayment as any);
      (service as any).stripe = {
        checkout: {
          sessions: {
            list: jest.fn(async () => ({
              data: [
                {
                  id: 'cs_test_123',
                  payment_status: 'paid',
                  status: 'complete',
                  amount_total: 1035,
                  currency: 'gbp',
                  created: Math.floor(Date.now() / 1000),
                  metadata: { type: 'event_ticket' },
                  payment_intent: 'pi_test_123',
                  payment_method_types: ['card'],
                  customer_details: null
                }
              ],
              has_more: false
            }))
          }
        },
        paymentIntents: {
          retrieve: jest.fn(async () => ({
            id: 'pi_test_123',
            latest_charge: {
              id: 'ch_test_123',
              balance_transaction: {
                id: 'bt_test_123',
                fee: 30,
                net: 1005
              }
            }
          }))
        },
        refunds: {
          list: jest.fn(async () => ({
            data: [{ amount: 1035 }]
          }))
        }
      };

      const result = await service.syncStripeRevenue();

      expect(result.created).toBe(0);
      expect(result.updated).toBe(1);
      expect(prismaWithExistingPayment.payment.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'pay-existing' },
          data: expect.objectContaining({
            processingFee: 0.3,
            netAmount: 10.05,
            refundedAmount: 10.35,
            paymentStatus: 'REFUNDED'
          })
        })
      );
    });

    it('skips unpaid sessions and reports errors without failing', async () => {
      const prismaWithNoPayments = {
        ...mockPrisma,
        payment: {
          findFirst: jest.fn(() => Promise.resolve(null)) as any,
          create: jest.fn(() => Promise.resolve({ id: 'pay-new' })) as any
        }
      };

      const service = new PaymentsService(mockConfig as any, prismaWithNoPayments as any);
      (service as any).stripe = {
        checkout: {
          sessions: {
            list: jest.fn(async () => ({
              data: [
                {
                  id: 'cs_test_unpaid',
                  payment_status: 'unpaid',
                  status: 'complete',
                  amount_total: 1035,
                  currency: 'gbp',
                  created: Math.floor(Date.now() / 1000),
                  metadata: {},
                  payment_intent: null,
                  payment_method_types: ['card'],
                  customer_details: null
                }
              ],
              has_more: false
            }))
          }
        }
      };

      const result = await service.syncStripeRevenue();

      expect(result.skipped).toBe(1);
      expect(result.created).toBe(0);
      expect(result.errors).toHaveLength(0);
    });

    it('throws when Stripe is not configured', async () => {
      const configWithoutStripe = {
        get: jest.fn((key: string) => {
          if (key === 'STRIPE_SECRET_KEY') return undefined;
          return undefined;
        })
      };
      const service = new PaymentsService(configWithoutStripe as any, mockPrisma as any);

      await expect(service.syncStripeRevenue()).rejects.toThrow('Stripe is not configured');
    });
  });

  describe('verifyPayPalWebhook', () => {
    const validHeaders = {
      'paypal-transmission-id': 'transmission-1',
      'paypal-transmission-time': new Date().toISOString(),
      'paypal-cert-url': 'https://api-m.paypal.com/v1/notifications/certs/Cert',
      'paypal-auth-algo': 'SHA256withRSA',
      'paypal-transmission-sig': 'valid-sig'
    };

    let createVerifySpy: any;

    const paypalConfig = {
      get: jest.fn((key: string) => {
        if (key === 'PAYPAL_WEBHOOK_ID') return 'webhook-id-1';
        if (key === 'PAYPAL_CLIENT_ID') return 'paypal-client-id';
        if (key === 'PAYPAL_CLIENT_SECRET') return 'paypal-client-secret';
        if (key === 'PAYPAL_API_BASE_URL') return 'https://api-m.sandbox.paypal.com';
        return undefined;
      })
    };

    beforeEach(() => {
      createVerifySpy = jest.spyOn(crypto, 'createVerify').mockReturnValue({
        update: jest.fn().mockReturnThis(),
        end: jest.fn().mockReturnThis(),
        verify: jest.fn().mockReturnValue(true)
      } as unknown as crypto.Verify);

      global.fetch = jest.fn(async () => ({
        ok: true,
        text: async () => 'mock-cert'
      })) as unknown as typeof fetch;
    });

    afterEach(() => {
      createVerifySpy.mockRestore();
    });

    it('throws when the PayPal webhook ID is not configured', async () => {
      const configWithoutWebhookId = {
        get: jest.fn((key: string) => {
          if (key === 'PAYPAL_WEBHOOK_ID') return undefined;
          return undefined;
        })
      };
      const service = new PaymentsService(configWithoutWebhookId as any, mockPrisma as any);

      await expect(service.verifyPayPalWebhook(Buffer.from('{}'), validHeaders)).rejects.toThrow(
        'PayPal webhook ID is not configured.'
      );
    });

    it('throws when the transmission time is outside the allowed clock-skew window', async () => {
      const staleHeaders = {
        ...validHeaders,
        'paypal-transmission-time': new Date(Date.now() - 10 * 60 * 1000).toISOString()
      };
      const service = new PaymentsService(paypalConfig as any, mockPrisma as any);

      await expect(service.verifyPayPalWebhook(Buffer.from('{}'), staleHeaders)).rejects.toThrow(
        'PayPal webhook transmission time is outside the allowed clock-skew window.'
      );
    });

    it('throws when the transmission id has already been recorded', async () => {
      const prismaWithDuplicate = {
        ...mockPrisma,
        webhookEvent: {
          findUnique: jest.fn(() => Promise.resolve({ id: 'existing-event' })) as any,
          create: jest.fn() as any
        }
      };
      const service = new PaymentsService(paypalConfig as any, prismaWithDuplicate as any);

      await expect(service.verifyPayPalWebhook(Buffer.from('{}'), validHeaders)).rejects.toThrow(
        'Duplicate PayPal webhook transmission transmission-1 ignored.'
      );
      expect(prismaWithDuplicate.webhookEvent.create).not.toHaveBeenCalled();
    });

    it('records the webhook event after successful signature verification', async () => {
      const prismaWithLedger = {
        ...mockPrisma,
        webhookEvent: {
          findUnique: jest.fn(() => Promise.resolve(null)) as any,
          create: jest.fn(() => Promise.resolve({ id: 'new-event' })) as any
        }
      };
      const service = new PaymentsService(paypalConfig as any, prismaWithLedger as any);

      await service.verifyPayPalWebhook(Buffer.from('{"event_type":"PAYMENT.CAPTURE.COMPLETED"}'), validHeaders);

      expect(prismaWithLedger.webhookEvent.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            provider: 'paypal',
            eventType: 'PAYMENT.CAPTURE.COMPLETED',
            externalId: 'transmission-1',
            status: 'received'
          })
        })
      );
    });
  });
});
