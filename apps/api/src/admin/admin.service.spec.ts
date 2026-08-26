import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { AdminService } from './admin.service.js';
import { MembershipStatus } from '@kentslsc/database';

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
    getOrCreateStripeCustomer: (jest.fn() as jest.Mock<() => Promise<string>>).mockResolvedValue('cus_test_user_1')
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
      mockConfigService
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

  it('queries pending and awaiting-approval paid memberships', async () => {
    mockPrisma.membership.findMany.mockImplementation((args: any) => {
      const where = args?.where ?? {};
      const matchesPaidPending =
        Array.isArray(where.status?.in) &&
        where.status.in.includes(MembershipStatus.PENDING) &&
        where.status.in.includes(MembershipStatus.AWAITING_APPROVAL) &&
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
      mockConfigService
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
