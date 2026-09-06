import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { FundraisingService } from './fundraising.service.js';
import { FundraiserStatus } from '@kentslsc/shared';
import { PaymentStatus, PaymentSourceType } from '@kentslsc/database';

jest.mock('gocardless-nodejs', () => ({
  GoCardlessClient: jest.fn(),
  Environments: { Live: 'live', Sandbox: 'sandbox' }
}));

const mockFrontendUrl = 'http://localhost:3000';

describe('FundraisingService checkout provider branching', () => {
  let service: FundraisingService;

  const mockFundraiser = {
    id: 'fundraiser-1',
    title: 'Save the clubhouse',
    status: FundraiserStatus.ACTIVE,
    isActive: true,
    deletedAt: null
  };

  const mockPrisma: any = {
    fundraiser: {
      findUnique: jest.fn()
    },
    payment: {
      create: jest.fn()
    }
  };

  const mockAiService: any = {};

  const mockPaymentsService: any = {
    createCheckout: (jest.fn() as jest.Mock<(...args: any[]) => Promise<any>>).mockResolvedValue({
      provider: 'stripe',
      id: 'cs_test_123',
      url: 'https://checkout.stripe.test/pay'
    }),
    getPublicPaymentSettings: jest.fn(),
    resolveCheckoutMethod: jest.fn(),
    calculateProcessingFee: jest.fn((netPence: number) => ({ net: netPence, fee: 20, gross: netPence + 20 }))
  };

  const mockConfigService: any = {
    get: jest.fn((key: string) => {
      if (key === 'FRONTEND_URL') return mockFrontendUrl;
      return undefined;
    })
  };

  const mockEmailService: any = {};

  const mockSupabase: any = {};

  const mockGoCardlessService: any = {
    getOrCreateCustomer: (jest.fn() as jest.Mock<() => Promise<string>>).mockResolvedValue('CU123'),
    createBillingRequestFlow: (jest.fn() as jest.Mock<(...args: any[]) => Promise<any>>).mockResolvedValue({
      provider: 'gocardless',
      id: 'BR123',
      url: 'https://pay.gocardless.test/flow/BR123'
    })
  };

  const baseDonation = {
    fundraiserId: mockFundraiser.id,
    amount: 25
  };

  // Mirrors the real PaymentsService.resolveCheckoutMethod semantics: an
  // explicit method always wins; omitted falls back to the default provider.
  const mockResolvedMethod = (defaultMethod: string, defaultProvider: string) =>
    mockPaymentsService.resolveCheckoutMethod.mockImplementation(async (requested?: string) =>
      requested
        ? { method: requested, provider: requested === 'card' ? 'stripe' : 'gocardless' }
        : { method: defaultMethod, provider: defaultProvider }
    );

  const useGoCardless = () => mockResolvedMethod('direct_debit', 'gocardless');

  const useStripe = () => mockResolvedMethod('card', 'stripe');

  beforeEach(() => {
    jest.clearAllMocks();
    mockPrisma.fundraiser.findUnique.mockResolvedValue(mockFundraiser);
    mockPrisma.payment.create.mockResolvedValue({ id: 'pay-pending' });
    useStripe();
    service = new FundraisingService(
      mockPrisma,
      mockAiService,
      mockPaymentsService,
      mockConfigService,
      mockEmailService,
      mockSupabase,
      mockGoCardlessService
    );
  });

  it('creates a one-off bacs billing request with donation metadata and a pending payment row', async () => {
    useGoCardless();

    const result = await service.createDonationSession(
      mockFundraiser.id,
      {
        ...baseDonation,
        displayName: 'Generous Donor',
        message: 'Good luck!',
        isAnonymous: false
      },
      'user-1'
    );

    expect(result).toEqual({
      sessionId: 'BR123',
      url: 'https://pay.gocardless.test/flow/BR123',
      provider: 'gocardless'
    });
    expect(mockGoCardlessService.getOrCreateCustomer).toHaveBeenCalledWith('user-1');
    expect(mockGoCardlessService.createBillingRequestFlow).toHaveBeenCalledWith(
      expect.objectContaining({
        plan: 'one_off',
        scheme: 'bacs',
        metadata: expect.objectContaining({
          type: 'donation',
          fundraiserId: mockFundraiser.id,
          amount: '2500',
          userId: 'user-1',
          displayName: 'Generous Donor',
          message: 'Good luck!',
          isAnonymous: 'false'
        })
      })
    );
    expect(mockPrisma.payment.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          userId: 'user-1',
          paymentChannel: 'gocardless',
          paymentMethod: 'direct_debit',
          paymentStatus: PaymentStatus.PENDING,
          providerCheckoutId: 'BR123',
          sourceType: PaymentSourceType.DONATION,
          metadata: expect.objectContaining({
            type: 'donation',
            fundraiserId: mockFundraiser.id,
            amount: '2500'
          })
        })
      })
    );
    expect(mockPaymentsService.createCheckout).not.toHaveBeenCalled();
  });

  it('excludes the processing fee from the billing request when the donor did not opt in', async () => {
    useGoCardless();

    await service.createDonationSession(mockFundraiser.id, baseDonation, 'user-1');

    expect(mockGoCardlessService.createBillingRequestFlow).toHaveBeenCalledWith(
      expect.objectContaining({ amountPence: 2500 })
    );
    expect(mockGoCardlessService.getOrCreateCustomer).toHaveBeenCalledWith('user-1');
  });

  it('includes the processing fee when the donor opted in and honours the payment scheme', async () => {
    useGoCardless();

    await service.createDonationSession(
      mockFundraiser.id,
      { ...baseDonation, addProcessingFee: true, paymentScheme: 'faster_payments' },
      'user-1'
    );

    expect(mockGoCardlessService.createBillingRequestFlow).toHaveBeenCalledWith(
      expect.objectContaining({ amountPence: 2520, scheme: 'faster_payments' })
    );
  });

  it('never touches GoCardless when the effective provider is stripe', async () => {
    useStripe();

    const result = await service.createDonationSession(mockFundraiser.id, baseDonation, 'user-1');

    expect(mockGoCardlessService.createBillingRequestFlow).not.toHaveBeenCalled();
    expect(mockGoCardlessService.getOrCreateCustomer).not.toHaveBeenCalled();
    expect(mockPaymentsService.createCheckout).toHaveBeenCalled();
    expect(result).toEqual(
      expect.objectContaining({ sessionId: 'cs_test_123', provider: 'stripe' })
    );
  });

  it('routes to Stripe when the donor explicitly picks card, even under a GoCardless default', async () => {
    useGoCardless();

    const result = await service.createDonationSession(
      mockFundraiser.id,
      { ...baseDonation, paymentMethod: 'card' },
      'user-1'
    );

    expect(mockPaymentsService.resolveCheckoutMethod).toHaveBeenCalledWith('card');
    expect(mockGoCardlessService.createBillingRequestFlow).not.toHaveBeenCalled();
    expect(mockPaymentsService.createCheckout).toHaveBeenCalled();
    expect(result).toEqual(
      expect.objectContaining({ sessionId: 'cs_test_123', provider: 'stripe' })
    );
  });

  it('routes to GoCardless with scheme bacs when the donor picks direct debit', async () => {
    useStripe();

    const result = await service.createDonationSession(
      mockFundraiser.id,
      { ...baseDonation, paymentMethod: 'direct_debit' },
      'user-1'
    );

    expect(mockPaymentsService.resolveCheckoutMethod).toHaveBeenCalledWith('direct_debit');
    expect(mockPaymentsService.createCheckout).not.toHaveBeenCalled();
    expect(mockGoCardlessService.createBillingRequestFlow).toHaveBeenCalledWith(
      expect.objectContaining({ plan: 'one_off', scheme: 'bacs' })
    );
    expect(result).toEqual(
      expect.objectContaining({ sessionId: 'BR123', provider: 'gocardless' })
    );
  });

  it('routes to GoCardless with scheme faster_payments when the donor picks instant bank pay', async () => {
    useStripe();

    const result = await service.createDonationSession(
      mockFundraiser.id,
      { ...baseDonation, paymentMethod: 'instant_bank_pay' },
      'user-1'
    );

    expect(mockPaymentsService.resolveCheckoutMethod).toHaveBeenCalledWith('instant_bank_pay');
    expect(mockGoCardlessService.createBillingRequestFlow).toHaveBeenCalledWith(
      expect.objectContaining({ plan: 'one_off', scheme: 'faster_payments' })
    );
    expect(result).toEqual(
      expect.objectContaining({ sessionId: 'BR123', provider: 'gocardless' })
    );
  });
});

describe('FundraisingService.handleGoCardlessPaymentCompleted', () => {
  let service: FundraisingService;

  const mockPrisma: any = {
    payment: {
      findFirst: jest.fn()
    },
    donation: {
      findFirst: jest.fn()
    }
  };

  const payment = {
    id: 'PM123',
    amount: '2500',
    currency: 'GBP',
    links: { billing_request: 'BR123' }
  };

  beforeEach(() => {
    jest.clearAllMocks();
    service = new FundraisingService(
      mockPrisma,
      {},
      {},
      { get: jest.fn() },
      {},
      {},
      {}
    );
  });

  it('throws when the donation metadata has no fundraiserId', async () => {
    await expect(
      service.handleGoCardlessPaymentCompleted(payment as any, { type: 'donation', amount: '2500' })
    ).rejects.toThrow('missing fundraiserId');
  });

  it('throws when the donation amount cannot be resolved', async () => {
    await expect(
      service.handleGoCardlessPaymentCompleted(
        { ...payment, amount: undefined } as any,
        { type: 'donation', fundraiserId: 'fundraiser-1' }
      )
    ).rejects.toThrow('no resolvable amount');
  });

  it('returns null for non-donation metadata without throwing', async () => {
    await expect(service.handleGoCardlessPaymentCompleted(payment as any, { source: 'membership' })).resolves.toBeNull();
    expect(mockPrisma.payment.findFirst).not.toHaveBeenCalled();
  });
});

describe('FundraisingService.handleCheckoutCompleted', () => {
  let service: FundraisingService;
  let tx: any;

  const mockPrisma: any = {
    donation: {
      findFirst: jest.fn()
    },
    fundraiser: {
      findUnique: jest.fn()
    },
    $transaction: jest.fn()
  };

  const mockEmailService: any = {
    sendDonationThankYou: jest.fn()
  };

  const baseSession = {
    id: 'cs_123',
    metadata: { type: 'donation', fundraiserId: 'fundraiser-1', amount: '2500' },
    amount_total: 2500,
    currency: 'gbp',
    customer_details: { email: 'donor@example.com' }
  };

  beforeEach(() => {
    jest.clearAllMocks();
    tx = {
      donation: { create: jest.fn().mockResolvedValue({ id: 'don-1' }) },
      payment: { create: jest.fn().mockResolvedValue({ id: 'pay-1' }) },
      fundraiser: { update: jest.fn().mockResolvedValue({ raisedAmount: 25, targetAmount: 100 }) }
    };
    mockPrisma.donation.findFirst.mockResolvedValue(null);
    mockPrisma.fundraiser.findUnique.mockResolvedValue(null);
    mockPrisma.$transaction.mockImplementation((fn: any) => fn(tx));
    mockEmailService.sendDonationThankYou.mockResolvedValue(undefined);
    service = new FundraisingService(mockPrisma, {}, {}, { get: jest.fn() }, mockEmailService, {}, {});
  });

  it('records the donation with the payment intent id when payment_intent is expanded', async () => {
    await service.handleCheckoutCompleted({
      ...baseSession,
      payment_intent: { id: 'pi_123', object: 'payment_intent' }
    } as any);

    expect(tx.donation.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ fundraiserId: 'fundraiser-1', paymentId: 'pi_123' })
      })
    );
    expect(tx.payment.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ providerPaymentId: 'pi_123', providerCheckoutId: 'cs_123' })
      })
    );
    expect(tx.fundraiser.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { raisedAmount: { increment: 25 }, totalDonors: { increment: 1 } } })
    );
  });

  it('records the donation when payment_intent is a plain id (webhook shape)', async () => {
    await service.handleCheckoutCompleted({ ...baseSession, payment_intent: 'pi_123' } as any);

    expect(tx.donation.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ paymentId: 'pi_123' })
      })
    );
  });
});
