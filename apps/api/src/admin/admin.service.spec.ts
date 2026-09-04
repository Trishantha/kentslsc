import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { AdminService } from './admin.service.js';
import { MembershipStatus, PaymentStatus, PaymentSourceType } from '@kentslsc/database';

jest.mock('gocardless-nodejs', () => ({
  GoCardlessClient: jest.fn(),
  Environments: { Live: 'live', Sandbox: 'sandbox' }
}));

const mockFrontendUrl = 'http://localhost:3000';

function createMockMembership(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: 'membership-1',
    userId: 'user-1',
    status: MembershipStatus.PENDING,
    paidAt: null,
    paymentMethod: null,
    membershipType: {
      id: 'type-paid',
      name: 'Paid Membership',
      price: 10,
      isFree: false,
      durationMonths: 12
    },
    user: {
      id: 'user-1',
      email: 'test@example.com',
      name: 'Test User',
      firstName: 'Test',
      lastName: 'User'
    },
    ...overrides
  };
}

describe('AdminService - sendPaymentRemindersToPending', () => {
  const mockPrisma: any = {
    membership: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn()
    }
  };

  const mockPaymentsService: any = {
    createSubscriptionCheckout: (jest.fn() as jest.Mock<(...args: any[]) => Promise<any>>).mockResolvedValue({
      id: 'cs_test_123',
      url: 'https://checkout.stripe.test/pay',
      provider: 'stripe'
    }),
    syncMembershipTypePrice: (jest.fn() as jest.Mock<(...args: any[]) => Promise<any>>).mockResolvedValue({
      productId: 'prod_test',
      priceId: 'price_test'
    }),
    getOrCreateStripeCustomer: (jest.fn() as jest.Mock<() => Promise<string>>).mockResolvedValue('cus_test_user_1'),
    getPublicPaymentSettings: (jest.fn() as jest.Mock<() => Promise<any>>).mockResolvedValue({
      provider: 'stripe',
      processingFeeEnabled: false,
      processingFeePercent: 0,
      processingFeeFixed: 0
    })
  };

  const mockGoCardlessService: any = {
    getOrCreateCustomer: (jest.fn() as jest.Mock<() => Promise<string>>).mockResolvedValue('CU123'),
    createBillingRequestFlow: jest.fn()
  };

  const mockEmailService: any = {
    sendMembershipPaymentLink: (jest.fn() as jest.Mock<(...args: any[]) => Promise<any>>).mockResolvedValue(undefined)
  };

  const mockConfigService: any = {
    get: jest.fn((key: string) => {
      if (key === 'FRONTEND_URL') return mockFrontendUrl;
      return undefined;
    })
  };

  let service: AdminService;

  beforeEach(() => {
    jest.clearAllMocks();
    mockPrisma.membership.findUnique.mockImplementation((args: any) => {
      const id = args?.where?.id;
      if (id === 'membership-1') return Promise.resolve(createMockMembership());
      if (id === 'membership-2') {
        return Promise.resolve(
          createMockMembership({
            id: 'membership-2',
            userId: 'user-2',
            user: { id: 'user-2', email: 'other@example.com', name: 'Other User' }
          })
        );
      }
      return Promise.resolve(null);
    });
    service = new AdminService(
      mockPrisma,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      mockPaymentsService,
      mockEmailService,
      mockConfigService,
      mockGoCardlessService
    );
  });

  it('sends payment reminders to all pending paid memberships', async () => {
    mockPrisma.membership.findMany.mockResolvedValue([
      createMockMembership(),
      createMockMembership({ id: 'membership-2', userId: 'user-2', user: { id: 'user-2', email: 'other@example.com', name: 'Other User' } })
    ]);

    const result = await service.sendPaymentRemindersToPending();

    expect(result).toEqual({ sent: 2, failed: 0, total: 2 });
    expect(mockPaymentsService.createSubscriptionCheckout).toHaveBeenCalledTimes(2);
    expect(mockEmailService.sendMembershipPaymentLink).toHaveBeenCalledTimes(2);
    expect(mockPaymentsService.createSubscriptionCheckout).toHaveBeenCalledWith(
      expect.objectContaining({ customer: 'cus_test_user_1' })
    );
  });

  it('queries pending and awaiting-payment paid memberships', async () => {
    mockPrisma.membership.findMany.mockImplementation((args: any) => {
      const where = args?.where ?? {};
      const matchesPaidPending =
        Array.isArray(where.status?.in) &&
        where.status.in.includes(MembershipStatus.PENDING) &&
        where.status.in.includes(MembershipStatus.AWAITING_PAYMENT) &&
        where.paidAt === null &&
        where.paymentMethod === null &&
        where.membershipType?.isFree === false;
      return Promise.resolve(matchesPaidPending ? [createMockMembership()] : []);
    });

    const result = await service.sendPaymentRemindersToPending();

    expect(result).toEqual({ sent: 1, failed: 0, total: 1 });
    expect(mockPaymentsService.createSubscriptionCheckout).toHaveBeenCalledTimes(1);
  });

  it('counts individual failures without stopping the batch', async () => {
    mockPrisma.membership.findMany.mockResolvedValue([
      createMockMembership(),
      createMockMembership({ id: 'membership-2' })
    ]);
    mockPaymentsService.createSubscriptionCheckout.mockRejectedValueOnce(new Error('Stripe error'));
    mockPaymentsService.createSubscriptionCheckout.mockResolvedValueOnce({
      id: 'cs_test_456',
      url: 'https://checkout.stripe.test/pay2',
      provider: 'stripe'
    });

    const result = await service.sendPaymentRemindersToPending();

    expect(result).toEqual({ sent: 1, failed: 1, total: 2 });
  });
});

describe('AdminService - regenerateAllMembershipCards', () => {
  const mockPrisma: any = {
    membership: {
      findMany: jest.fn()
    }
  };

  const mockMembershipsService: any = {
    regenerateCard: jest.fn()
  };

  const mockConfigService: any = {
    get: jest.fn((key: string) => {
      if (key === 'FRONTEND_URL') return mockFrontendUrl;
      return undefined;
    })
  };

  let service: AdminService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new AdminService(
      mockPrisma,
      {} as any,
      mockMembershipsService,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      mockConfigService,
      {} as any
    );
  });

  it('regenerates cards for active memberships and counts failures', async () => {
    mockPrisma.membership.findMany.mockResolvedValue([
      { membershipId: 'MEM-AAAA0000' },
      { membershipId: 'MEM-BBBB0000' },
      { membershipId: 'MEM-CCCC0000' }
    ]);
    mockMembershipsService.regenerateCard
      .mockResolvedValueOnce({ membershipId: 'MEM-AAAA0000' })
      .mockRejectedValueOnce(new Error('Card failed'))
      .mockResolvedValueOnce({ membershipId: 'MEM-CCCC0000' });

    const result = await service.regenerateAllMembershipCards();

    expect(result).toEqual({
      regenerated: 2,
      failed: 1,
      total: 3,
      errors: [{ membershipId: 'MEM-BBBB0000', error: 'Card failed' }]
    });
    expect(mockPrisma.membership.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ status: MembershipStatus.ACTIVE, deletedAt: null })
      })
    );
    expect(mockMembershipsService.regenerateCard).toHaveBeenCalledTimes(3);
  });

  it('can include non-active memberships when onlyActive is false', async () => {
    mockPrisma.membership.findMany.mockResolvedValue([
      { membershipId: 'MEM-AAAA0000' },
      { membershipId: 'MEM-BBBB0000' }
    ]);
    mockMembershipsService.regenerateCard.mockResolvedValue({});

    await service.regenerateAllMembershipCards({ onlyActive: false });

    expect(mockPrisma.membership.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ deletedAt: null })
      })
    );
    expect(mockMembershipsService.regenerateCard).toHaveBeenCalledTimes(2);
  });
});

describe('AdminService - sendMembershipPaymentLink provider branching', () => {
  const mockPrisma: any = {
    membership: {
      findUnique: jest.fn(),
      update: jest.fn()
    },
    payment: {
      create: jest.fn()
    }
  };

  const mockPaymentsService: any = {
    createSubscriptionCheckout: (jest.fn() as jest.Mock<(...args: any[]) => Promise<any>>).mockResolvedValue({
      id: 'cs_test_123',
      url: 'https://checkout.stripe.test/pay',
      provider: 'stripe'
    }),
    syncMembershipTypePrice: (jest.fn() as jest.Mock<(...args: any[]) => Promise<any>>).mockResolvedValue({
      productId: 'prod_test',
      priceId: 'price_test'
    }),
    getOrCreateStripeCustomer: (jest.fn() as jest.Mock<() => Promise<string>>).mockResolvedValue('cus_test_user_1'),
    calculateProcessingFee: jest.fn((netPence: number) => ({ net: netPence, fee: 20, gross: netPence + 20 })),
    getPublicPaymentSettings: jest.fn()
  };

  const mockGoCardlessService: any = {
    getOrCreateCustomer: (jest.fn() as jest.Mock<() => Promise<string>>).mockResolvedValue('CU123'),
    createBillingRequestFlow: (jest.fn() as jest.Mock<(...args: any[]) => Promise<any>>).mockResolvedValue({
      provider: 'gocardless',
      id: 'BR123',
      url: 'https://pay.gocardless.test/flow/BR123'
    })
  };

  const mockEmailService: any = {
    sendMembershipPaymentLink: (jest.fn() as jest.Mock<(...args: any[]) => Promise<any>>).mockResolvedValue(undefined)
  };

  const mockConfigService: any = {
    get: jest.fn((key: string) => {
      if (key === 'FRONTEND_URL') return mockFrontendUrl;
      return undefined;
    })
  };

  let service: AdminService;

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
    mockPrisma.membership.findUnique.mockResolvedValue(createMockMembership());
    mockPrisma.membership.update.mockResolvedValue({});
    mockPrisma.payment.create.mockResolvedValue({ id: 'pay-pending' });
    service = new AdminService(
      mockPrisma,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      mockPaymentsService,
      mockEmailService,
      mockConfigService,
      mockGoCardlessService
    );
  });

  it('creates a one-off bacs billing request with membership metadata and a pending payment row', async () => {
    useGoCardless();

    const result = await service.sendMembershipPaymentLink('membership-1');

    expect(mockGoCardlessService.createBillingRequestFlow).toHaveBeenCalledWith(
      expect.objectContaining({
        plan: 'one_off',
        amountPence: 1000,
        metadata: expect.objectContaining({
          source: 'membership',
          membershipId: 'membership-1',
          userId: 'user-1'
        }),
        redirectUri: expect.stringContaining('membership=success&session_id={BILLING_REQUEST_ID}')
      })
    );
    expect(mockPrisma.payment.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          paymentChannel: 'gocardless',
          paymentStatus: PaymentStatus.PENDING,
          providerCheckoutId: 'BR123',
          sourceType: PaymentSourceType.MEMBERSHIP,
          sourceId: 'membership-1'
        })
      })
    );
    expect(mockEmailService.sendMembershipPaymentLink).toHaveBeenCalledWith(
      'test@example.com',
      'Test User',
      'Paid Membership',
      'https://pay.gocardless.test/flow/BR123'
    );
    expect(result).toEqual({ url: 'https://pay.gocardless.test/flow/BR123', provider: 'gocardless' });
    expect(mockPaymentsService.createSubscriptionCheckout).not.toHaveBeenCalled();
  });

  it('creates a subscription billing request when paymentPlan is subscription', async () => {
    useGoCardless();

    await service.sendMembershipPaymentLink('membership-1', { paymentPlan: 'subscription' });

    expect(mockGoCardlessService.createBillingRequestFlow).toHaveBeenCalledWith(
      expect.objectContaining({
        plan: 'subscription',
        subscriptionIntervalUnit: 'yearly',
        subscriptionInterval: 1
      })
    );
  });

  it('defaults instalment plans to 10 instalments and clamps the count to 2-12', async () => {
    useGoCardless();

    await service.sendMembershipPaymentLink('membership-1', { paymentPlan: 'instalments' });
    expect(mockGoCardlessService.createBillingRequestFlow).toHaveBeenLastCalledWith(
      expect.objectContaining({ plan: 'instalments', instalmentCount: 10 })
    );

    await service.sendMembershipPaymentLink('membership-1', { paymentPlan: 'instalments', instalmentCount: 1 });
    expect(mockGoCardlessService.createBillingRequestFlow).toHaveBeenLastCalledWith(
      expect.objectContaining({ plan: 'instalments', instalmentCount: 2 })
    );

    await service.sendMembershipPaymentLink('membership-1', { paymentPlan: 'instalments', instalmentCount: 15 });
    expect(mockGoCardlessService.createBillingRequestFlow).toHaveBeenLastCalledWith(
      expect.objectContaining({ plan: 'instalments', instalmentCount: 12 })
    );
  });

  it('never touches GoCardless when the effective provider is stripe', async () => {
    useStripe();

    const result = await service.sendMembershipPaymentLink('membership-1');

    expect(mockGoCardlessService.createBillingRequestFlow).not.toHaveBeenCalled();
    expect(mockGoCardlessService.getOrCreateCustomer).not.toHaveBeenCalled();
    expect(mockPaymentsService.createSubscriptionCheckout).toHaveBeenCalled();
    expect(result).toEqual({ url: 'https://checkout.stripe.test/pay', provider: 'stripe' });
  });
});

describe('AdminService - getDashboardStats', () => {
  const mockPrisma: any = {
    user: { count: jest.fn().mockResolvedValue(10) },
    membership: {
      count: jest
        .fn()
        .mockResolvedValueOnce(5)
        .mockResolvedValueOnce(2)
    },
    event: { count: jest.fn().mockResolvedValue(3) },
    businessListing: { count: jest.fn().mockResolvedValue(4) },
    fundraiser: { count: jest.fn().mockResolvedValue(1) },
    blogPost: { count: jest.fn().mockResolvedValue(6) },
    contactMessage: { count: jest.fn().mockResolvedValue(7) },
    membershipType: { findMany: jest.fn().mockResolvedValue([]) },
    forumTopic: { count: jest.fn().mockResolvedValue(1) },
    forumPost: { count: jest.fn().mockResolvedValue(1) }
  };

  const service = new AdminService(
    mockPrisma,
    {} as any,
    {} as any,
    {} as any,
    {} as any,
    {} as any,
    {} as any,
    {} as any,
    {} as any,
    {} as any,
    { get: () => mockFrontendUrl } as any,
    {} as any
  );

  it('counts only active memberships, excluding cancelled/pending/expired', async () => {
    const result = await service.getDashboardStats();

    expect(result.memberships).toBe(5);
    expect(result.pendingMemberships).toBe(2);
    expect(mockPrisma.membership.count).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        where: { deletedAt: null, status: MembershipStatus.ACTIVE }
      })
    );
  });
});
