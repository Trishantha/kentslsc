import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { DirectoryService } from './directory.service.js';
import { UserRole } from '@kentslsc/shared';
import { PaymentStatus, PaymentSourceType } from '@kentslsc/database';
import type { TokenPayload } from '@kentslsc/shared';

jest.mock('gocardless-nodejs', () => ({
  GoCardlessClient: jest.fn(),
  Environments: { Live: 'live', Sandbox: 'sandbox' }
}));

const mockFrontendUrl = 'http://localhost:3000';

describe('DirectoryService checkout provider branching', () => {
  let service: DirectoryService;

  const ownerUser: TokenPayload = {
    sub: 'user-1',
    role: UserRole.MEMBER
  } as unknown as TokenPayload;

  const mockListing = {
    id: 'listing-1',
    businessName: 'Test Business',
    ownerUserId: 'user-1',
    deletedAt: null
  };

  const mockJob = {
    id: 'job-1',
    title: 'Lifeguard wanted',
    businessListingId: 'listing-1',
    ownerUserId: 'user-1',
    deletedAt: null,
    businessListing: { ownerUserId: 'user-1' }
  };

  const mockPrisma: any = {
    businessListing: {
      findFirst: jest.fn()
    },
    jobAd: {
      findFirst: jest.fn()
    },
    payment: {
      create: jest.fn()
    }
  };

  const mockPaymentsService: any = {
    createCheckout: (jest.fn() as jest.Mock<(...args: any[]) => Promise<any>>).mockResolvedValue({
      provider: 'stripe',
      id: 'cs_test_123',
      url: 'https://checkout.stripe.test/pay'
    }),
    getPublicPaymentSettings: jest.fn(),
    calculateProcessingFee: jest.fn((netPence: number) => ({ net: netPence, fee: 0, gross: netPence }))
  };

  const mockEmailService: any = {};

  const mockConfigService: any = {
    get: jest.fn((key: string) => {
      if (key === 'FRONTEND_URL') return mockFrontendUrl;
      return undefined;
    })
  };

  const mockGoCardlessService: any = {
    getOrCreateCustomer: (jest.fn() as jest.Mock<() => Promise<string>>).mockResolvedValue('CU123'),
    createBillingRequestFlow: (jest.fn() as jest.Mock<(...args: any[]) => Promise<any>>).mockResolvedValue({
      provider: 'gocardless',
      id: 'BR123',
      url: 'https://pay.gocardless.test/flow/BR123'
    })
  };

  const useGoCardless = () =>
    mockPaymentsService.getPublicPaymentSettings.mockResolvedValue({
      provider: 'gocardless',
      processingFeeEnabled: false,
      processingFeePercent: 0,
      processingFeeFixed: 0
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
    mockPrisma.payment.create.mockResolvedValue({ id: 'pay-pending' });
    service = new DirectoryService(
      mockPrisma,
      mockPaymentsService,
      mockEmailService,
      mockConfigService,
      mockGoCardlessService
    );
  });

  describe('createPromotionCheckout', () => {
    it('creates a one-off bacs billing request with directory_promotion metadata and a pending payment row', async () => {
      useGoCardless();
      mockPrisma.businessListing.findFirst.mockResolvedValue(mockListing);

      const result = await service.createPromotionCheckout(ownerUser, mockListing.id, {});

      expect(result).toEqual({
        sessionId: 'BR123',
        url: 'https://pay.gocardless.test/flow/BR123',
        provider: 'gocardless'
      });
      expect(mockGoCardlessService.createBillingRequestFlow).toHaveBeenCalledWith(
        expect.objectContaining({
          plan: 'one_off',
          scheme: 'bacs',
          metadata: expect.objectContaining({
            type: 'directory_promotion',
            businessListingId: mockListing.id
          })
        })
      );
      expect(mockPrisma.payment.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            userId: 'user-1',
            businessListingId: mockListing.id,
            paymentChannel: 'gocardless',
            paymentStatus: PaymentStatus.PENDING,
            providerCheckoutId: 'BR123',
            sourceType: PaymentSourceType.DIRECTORY_PROMOTION,
            sourceId: mockListing.id
          })
        })
      );
      expect(mockPaymentsService.createCheckout).not.toHaveBeenCalled();
    });

    it('honours the requested payment scheme', async () => {
      useGoCardless();
      mockPrisma.businessListing.findFirst.mockResolvedValue(mockListing);

      await service.createPromotionCheckout(ownerUser, mockListing.id, {
        paymentScheme: 'faster_payments'
      });

      expect(mockGoCardlessService.createBillingRequestFlow).toHaveBeenCalledWith(
        expect.objectContaining({ scheme: 'faster_payments' })
      );
    });

    it('never touches GoCardless when the effective provider is stripe', async () => {
      useStripe();
      mockPrisma.businessListing.findFirst.mockResolvedValue(mockListing);

      const result = await service.createPromotionCheckout(ownerUser, mockListing.id, {});

      expect(mockGoCardlessService.createBillingRequestFlow).not.toHaveBeenCalled();
      expect(mockGoCardlessService.getOrCreateCustomer).not.toHaveBeenCalled();
      expect(mockPaymentsService.createCheckout).toHaveBeenCalled();
      expect(result).toEqual(
        expect.objectContaining({ sessionId: 'cs_test_123', provider: 'stripe' })
      );
    });
  });

  describe('createJobPublishCheckout', () => {
    it('creates a one-off billing request with job_publish metadata and a pending payment row', async () => {
      useGoCardless();
      mockPrisma.jobAd.findFirst.mockResolvedValue(mockJob);

      const result = await service.createJobPublishCheckout(ownerUser, mockJob.id, {});

      expect(result).toEqual({
        sessionId: 'BR123',
        url: 'https://pay.gocardless.test/flow/BR123',
        provider: 'gocardless'
      });
      expect(mockGoCardlessService.createBillingRequestFlow).toHaveBeenCalledWith(
        expect.objectContaining({
          plan: 'one_off',
          scheme: 'bacs',
          metadata: expect.objectContaining({
            type: 'job_publish',
            jobAdId: mockJob.id
          })
        })
      );
      expect(mockPrisma.payment.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            userId: 'user-1',
            jobAdId: mockJob.id,
            paymentChannel: 'gocardless',
            paymentStatus: PaymentStatus.PENDING,
            providerCheckoutId: 'BR123',
            sourceType: PaymentSourceType.JOB_PUBLISH,
            sourceId: mockJob.id
          })
        })
      );
      expect(mockPaymentsService.createCheckout).not.toHaveBeenCalled();
    });

    it('never touches GoCardless when the effective provider is stripe', async () => {
      useStripe();
      mockPrisma.jobAd.findFirst.mockResolvedValue(mockJob);

      await service.createJobPublishCheckout(ownerUser, mockJob.id, {});

      expect(mockGoCardlessService.createBillingRequestFlow).not.toHaveBeenCalled();
      expect(mockPaymentsService.createCheckout).toHaveBeenCalled();
    });
  });
});
