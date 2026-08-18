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
      isFree: false
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
      findUnique: jest.fn()
    }
  };

  const mockPaymentsService: any = {
    createCheckout: (jest.fn() as jest.Mock<(...args: any[]) => Promise<any>>).mockResolvedValue({
      id: 'cs_test_123',
      url: 'https://checkout.stripe.test/pay',
      provider: 'stripe'
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
    expect(mockPaymentsService.createCheckout).toHaveBeenCalledTimes(2);
    expect(mockEmailService.sendMembershipPaymentLink).toHaveBeenCalledTimes(2);
  });

  it('queries only pending paid memberships', async () => {
    mockPrisma.membership.findMany.mockImplementation((args: any) => {
      const where = args?.where ?? {};
      const matchesPaidPending =
        where.status === MembershipStatus.PENDING &&
        where.paidAt === null &&
        where.paymentMethod === null &&
        where.membershipType?.isFree === false;
      return Promise.resolve(matchesPaidPending ? [createMockMembership()] : []);
    });

    const result = await service.sendPaymentRemindersToPending();

    expect(result).toEqual({ sent: 1, failed: 0, total: 1 });
    expect(mockPaymentsService.createCheckout).toHaveBeenCalledTimes(1);
  });

  it('counts individual failures without stopping the batch', async () => {
    mockPrisma.membership.findMany.mockResolvedValue([
      createMockMembership(),
      createMockMembership({ id: 'membership-2' })
    ]);
    mockPaymentsService.createCheckout.mockRejectedValueOnce(new Error('Stripe error'));
    mockPaymentsService.createCheckout.mockResolvedValueOnce({
      id: 'cs_test_456',
      url: 'https://checkout.stripe.test/pay2',
      provider: 'stripe'
    });

    const result = await service.sendPaymentRemindersToPending();

    expect(result).toEqual({ sent: 1, failed: 1, total: 2 });
  });
});
