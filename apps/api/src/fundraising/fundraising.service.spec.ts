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

  const useGoCardless = () =>
    mockPaymentsService.getPublicPaymentSettings.mockResolvedValue({
      provider: 'gocardless',
      processingFeeEnabled: true,
      processingFeePercent: 1.5,
      processingFeeFixed: 20
    });

  const useStripe = () =>
    mockPaymentsService.getPublicPaymentSettings.mockResolvedValue({
      provider: 'stripe',
      processingFeeEnabled: false,
      processingFeePercent: 0,
      processingFeeFixed: 0
    });

  beforeEach(() => {
    jest.clearAllMocks();
    mockPrisma.fundraiser.findUnique.mockResolvedValue(mockFundraiser);
    mockPrisma.payment.create.mockResolvedValue({ id: 'pay-pending' });
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
          sourceType: PaymentSourceType.DONATION
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
});
