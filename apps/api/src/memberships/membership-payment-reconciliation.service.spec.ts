import { Test, TestingModule } from '@nestjs/testing';
import { MembershipStatus } from '@kentslsc/database';
import { MembershipPaymentReconciliationService } from './membership-payment-reconciliation.service.js';
import { MembershipsService } from './memberships.service.js';
import { PaymentsService } from '../payments/payments.service.js';
import { PrismaService } from '../core/prisma/prisma.service.js';

describe('MembershipPaymentReconciliationService', () => {
  let service: MembershipPaymentReconciliationService;

  const mockPrisma: any = {
    membership: {
      findMany: jest.fn() as jest.Mock<(...args: any[]) => Promise<any>>
    }
  };

  const mockPaymentsService: any = {
    listCustomerSubscriptions: jest.fn() as jest.Mock<(...args: any[]) => Promise<any>>
  };

  const mockMembershipsService: any = {
    applyPaidSubscription: jest.fn() as jest.Mock<(...args: any[]) => Promise<any>>
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MembershipPaymentReconciliationService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: PaymentsService, useValue: mockPaymentsService },
        { provide: MembershipsService, useValue: mockMembershipsService }
      ]
    }).compile();

    service = module.get(MembershipPaymentReconciliationService);
  });

  it('activates memberships whose Stripe subscription is already paid', async () => {
    mockPrisma.membership.findMany.mockResolvedValue([
      {
        id: 'membership-1',
        membershipId: 'MEM-ABCDEFGH',
        stripeCustomerId: 'cus_1',
        stripePriceId: 'price_1'
      }
    ]);
    const subscription = {
      id: 'sub_1',
      status: 'active',
      items: { data: [{ price: { id: 'price_1' } }] }
    };
    mockPaymentsService.listCustomerSubscriptions.mockResolvedValue([subscription]);
    mockMembershipsService.applyPaidSubscription.mockResolvedValue({ activated: true });

    const result = await service.reconcilePendingPayments();

    expect(mockPrisma.membership.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ status: MembershipStatus.AWAITING_PAYMENT, paidAt: null })
      })
    );
    expect(mockMembershipsService.applyPaidSubscription).toHaveBeenCalledWith(
      'membership-1',
      subscription
    );
    expect(result).toEqual({ checked: 1, activated: 1 });
  });

  it('ignores subscriptions that are not paid or do not match the expected price', async () => {
    mockPrisma.membership.findMany.mockResolvedValue([
      {
        id: 'membership-1',
        membershipId: 'MEM-ABCDEFGH',
        stripeCustomerId: 'cus_1',
        stripePriceId: 'price_1'
      }
    ]);
    mockPaymentsService.listCustomerSubscriptions.mockResolvedValue([
      { id: 'sub_1', status: 'incomplete', items: { data: [{ price: { id: 'price_1' } }] } },
      { id: 'sub_2', status: 'active', items: { data: [{ price: { id: 'price_other' } }] } }
    ]);

    const result = await service.reconcilePendingPayments();

    expect(mockMembershipsService.applyPaidSubscription).not.toHaveBeenCalled();
    expect(result).toEqual({ checked: 1, activated: 0 });
  });

  it('keeps going when Stripe cannot be reached for one membership', async () => {
    mockPrisma.membership.findMany.mockResolvedValue([
      { id: 'membership-1', membershipId: 'MEM-1', stripeCustomerId: 'cus_1', stripePriceId: null },
      { id: 'membership-2', membershipId: 'MEM-2', stripeCustomerId: 'cus_2', stripePriceId: null }
    ]);
    mockPaymentsService.listCustomerSubscriptions
      .mockRejectedValueOnce(new Error('Stripe is unavailable'))
      .mockResolvedValueOnce([{ id: 'sub_2', status: 'active', items: { data: [] } }]);
    mockMembershipsService.applyPaidSubscription.mockResolvedValue({ activated: true });

    const result = await service.reconcilePendingPayments();

    expect(result).toEqual({ checked: 2, activated: 1 });
  });
});
