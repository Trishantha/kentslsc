import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { MembershipsService } from './memberships.service.js';
import { MembershipStatus } from '@kentslsc/database';
import type { ApplyMembershipDto } from './dto/apply-membership.dto.js';

const mockMembershipType = {
  id: 'type-free',
  name: 'Free Membership',
  description: null,
  price: 0,
  isFree: true,
  durationMonths: 12,
  maxIssuances: null,
  benefits: [],
  features: [],
  autoActivate: true,
  grantsMemberRole: true,
  createdAt: new Date(),
  updatedAt: new Date(),
  deletedAt: null
};

const mockPaidMembershipType = {
  ...mockMembershipType,
  id: 'type-paid',
  name: 'Paid Membership',
  price: 10,
  isFree: false
};

const mockExpensiveMembershipType = {
  ...mockPaidMembershipType,
  id: 'type-expensive',
  name: 'Expensive Membership',
  price: 20
};

const mockCheapMembershipType = {
  ...mockPaidMembershipType,
  id: 'type-cheap',
  name: 'Cheap Membership',
  price: 5,
  durationMonths: 12
};

const mockCreatedMembership = {
  id: 'membership-1',
  userId: 'user-1',
  membershipTypeId: 'type-free',
  membershipId: 'MEM-ABCDEFGH',
  startDate: new Date(),
  endDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
  status: MembershipStatus.ACTIVE,
  dependantsJson: null,
  membershipCardUrl: null,
  qrCodeValue: 'http://localhost:3000/membership/verify/MEM-ABCDEFGH',
  issuedAt: new Date(),
  createdAt: new Date(),
  updatedAt: new Date(),
  deletedAt: null,
  membershipType: mockMembershipType
};

const mockPendingMembership = {
  ...mockCreatedMembership,
  id: 'membership-pending',
  status: MembershipStatus.PENDING,
  membershipType: mockPaidMembershipType
};

const mockAwaitingApprovalMembership = {
  ...mockCreatedMembership,
  id: 'membership-awaiting',
  status: MembershipStatus.AWAITING_APPROVAL,
  membershipType: mockPaidMembershipType
};

const mockActivePaidMembership = {
  ...mockCreatedMembership,
  id: 'membership-active-paid',
  status: MembershipStatus.ACTIVE,
  startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
  endDate: new Date(Date.now() + 335 * 24 * 60 * 60 * 1000),
  membershipType: mockExpensiveMembershipType
};

const mockCreditMembership = {
  ...mockCreatedMembership,
  id: 'membership-credit',
  status: MembershipStatus.ACTIVE,
  membershipType: mockCheapMembershipType,
  creditAmountApplied: 9.16,
  creditMonthsGranted: 22
};

const mockSubscriptionCheckoutResult = {
  id: 'cs_test_123',
  url: 'https://checkout.stripe.test/pay',
  provider: 'stripe',
  clientSecret: 'cs_test_secret'
};

const mockSyncedPrice = {
  productId: 'prod_test_1',
  priceId: 'price_test_1'
};

describe('MembershipsService', () => {
  let service: MembershipsService;

  const mockPrisma: any = {
    membershipType: {
      findUnique: jest.fn(),
      findFirst: jest.fn()
    },
    membership: {
      count: jest.fn(),
      create: jest.fn(),
      updateMany: jest.fn(),
      update: jest.fn(),
      findUnique: jest.fn(),
      findFirst: jest.fn()
    },
    user: {
      findUnique: jest.fn(),
      update: jest.fn()
    },
    payment: {
      findFirst: jest.fn(),
      create: jest.fn()
    },
    authEvent: {
      create: jest.fn()
    },
    session: {
      updateMany: jest.fn()
    },
    siteSettings: {
      findFirst: (jest.fn() as jest.Mock<(...args: any[]) => Promise<any>>).mockResolvedValue(null)
    }
  };

  const mockPaymentsService: any = {
    createCheckout: (jest.fn() as jest.Mock<(...args: any[]) => Promise<any>>).mockResolvedValue(mockSubscriptionCheckoutResult),
    createSubscriptionCheckout: (jest.fn() as jest.Mock<(...args: any[]) => Promise<any>>).mockResolvedValue(mockSubscriptionCheckoutResult),
    syncMembershipTypePrice: (jest.fn() as jest.Mock<(...args: any[]) => Promise<any>>).mockResolvedValue(mockSyncedPrice),
    getOrCreateStripeCustomer: (jest.fn() as jest.Mock<() => Promise<string>>).mockResolvedValue('cus_test_user_1'),
    getSubscription: (jest.fn() as jest.Mock<(...args: any[]) => Promise<any>>).mockResolvedValue({
      id: 'sub_test_1',
      items: { data: [{ id: 'si_test_1', price: { id: 'price_test_1' } }] },
      current_period_end: Math.floor(Date.now() / 1000) + 365 * 24 * 60 * 60,
      status: 'active',
      customer: 'cus_test_user_1'
    }),
    updateSubscriptionPrice: (jest.fn() as jest.Mock<(...args: any[]) => Promise<any>>).mockResolvedValue({
      id: 'sub_test_1',
      items: { data: [{ id: 'si_test_1', price: { id: 'price_test_2' } }] },
      current_period_end: Math.floor(Date.now() / 1000) + 365 * 24 * 60 * 60,
      status: 'active'
    }),
    cancelSubscription: (jest.fn() as jest.Mock<(...args: any[]) => Promise<any>>).mockResolvedValue(undefined),
    syncStripeFeesByPaymentIntent: (jest.fn() as jest.Mock<(...args: any[]) => Promise<any>>).mockResolvedValue(undefined)
  };

  const mockEmailService: any = {
    send: (jest.fn() as jest.Mock<(...args: any[]) => Promise<any>>).mockResolvedValue(undefined),
    sendMembershipAwaitingApprovalEmail: (jest.fn() as jest.Mock<(...args: any[]) => Promise<any>>).mockResolvedValue(undefined),
    sendMembershipApplicationAdminNotification: (jest.fn() as jest.Mock<(...args: any[]) => Promise<any>>).mockResolvedValue(undefined),
    sendMembershipRejectedEmail: (jest.fn() as jest.Mock<(...args: any[]) => Promise<any>>).mockResolvedValue(undefined)
  };

  const mockAiService: any = {
    welcome: (jest.fn() as jest.Mock<(...args: any[]) => Promise<any>>).mockResolvedValue('Welcome!')
  };

  const mockConfigService: any = {
    get: jest.fn((key: string) => {
      if (key === 'FRONTEND_URL') return 'http://localhost:3000';
      if (key === 'API_URL') return 'http://localhost:4000';
      return undefined;
    })
  };

  const mockSupabaseStorage: any = {
    uploadBuffer: jest.fn()
  };

  const mockRefundsService: any = {
    refundPayment: (jest.fn() as jest.Mock<(...args: any[]) => Promise<any>>).mockResolvedValue(undefined)
  };

  beforeEach(() => {
    jest.clearAllMocks();
    service = new MembershipsService(
      mockPrisma,
      mockPaymentsService,
      mockRefundsService,
      mockEmailService,
      mockAiService,
      mockConfigService,
      mockSupabaseStorage
    );
  });

  describe('processApplication', () => {
    it('creates an active free membership even when card upload fails', async () => {
      const dto: ApplyMembershipDto = {
        membershipTypeId: 'type-free',
        fullName: 'Test User',
        phone: '+441234567890',
        address: {
          buildingStreet: '1 Test St',
          locality: 'Test locality',
          townCity: 'Test Town',
          postcode: 'TE1 1ST'
        },
        dependants: []
      };

      mockPrisma.membershipType.findUnique.mockResolvedValue(mockMembershipType);
      mockPrisma.membership.count.mockResolvedValue(0);
      mockPrisma.membership.create.mockResolvedValue(mockCreatedMembership);
      mockPrisma.membership.findFirst.mockResolvedValue(null);
      mockPrisma.user.update.mockResolvedValue({ id: 'user-1' });
      mockPrisma.user.findUnique.mockResolvedValue({ id: 'user-1', email: 'test@example.com' });
      mockSupabaseStorage.uploadBuffer.mockRejectedValue(new Error('Supabase is not configured'));

      const result = await service.processApplication('user-1', 'test@example.com', dto);

      expect(result).toEqual({ membership: mockCreatedMembership, paid: false });
      expect(mockPrisma.membership.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            userId: 'user-1',
            deletedAt: null,
            status: { in: [MembershipStatus.ACTIVE, MembershipStatus.PENDING, MembershipStatus.AWAITING_APPROVAL] }
          }),
          data: { status: MembershipStatus.CANCELLED, updatedAt: expect.any(Date) }
        })
      );
      expect(mockPrisma.membership.create).toHaveBeenCalled();
      expect(mockSupabaseStorage.uploadBuffer).toHaveBeenCalled();
      expect(mockEmailService.send).toHaveBeenCalled();
      expect(mockPrisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'user-1' },
          data: expect.objectContaining({ name: 'Test User' })
        })
      );
    });

    it('creates an awaiting-approval membership for paid types and creates an embedded checkout session', async () => {
      const dto: ApplyMembershipDto = {
        membershipTypeId: 'type-paid',
        fullName: 'Test User',
        phone: '+441234567890',
        address: {
          buildingStreet: '1 Test St',
          locality: 'Test locality',
          townCity: 'Test Town',
          postcode: 'TE1 1ST'
        },
        dependants: []
      };

      mockPrisma.membershipType.findUnique.mockResolvedValue(mockPaidMembershipType);
      mockPrisma.membership.count.mockResolvedValue(0);
      mockPrisma.membership.create.mockResolvedValue(mockAwaitingApprovalMembership);
      mockPrisma.membership.findFirst.mockResolvedValue(null);
      mockPrisma.user.update.mockResolvedValue({ id: 'user-1' });

      const result = await service.processApplication('user-1', 'test@example.com', dto);

      expect(result).toEqual({
        membership: mockAwaitingApprovalMembership,
        paid: true,
        awaitingApproval: true,
        sessionId: mockSubscriptionCheckoutResult.id,
        clientSecret: mockSubscriptionCheckoutResult.clientSecret,
        url: mockSubscriptionCheckoutResult.url
      });
      expect(mockPrisma.membership.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            userId: 'user-1',
            membershipTypeId: 'type-paid',
            status: MembershipStatus.AWAITING_APPROVAL,
            stripeCustomerId: 'cus_test_user_1',
            stripePriceId: mockSyncedPrice.priceId
          })
        })
      );
      expect(mockPaymentsService.createSubscriptionCheckout).toHaveBeenCalledWith(
        expect.objectContaining({
          priceId: mockSyncedPrice.priceId,
          customer: 'cus_test_user_1',
          uiMode: 'embedded',
          metadata: expect.objectContaining({
            source: 'membership',
            membershipId: mockAwaitingApprovalMembership.id
          })
        })
      );
      expect(mockPaymentsService.getOrCreateStripeCustomer).toHaveBeenCalledWith('user-1', 'test@example.com');
    });

    it('cancels previous awaiting-approval memberships when re-applying for a paid type', async () => {
      const dto: ApplyMembershipDto = {
        membershipTypeId: 'type-paid',
        fullName: 'Test User',
        phone: '+441234567890',
        address: {
          buildingStreet: '1 Test St',
          locality: 'Test locality',
          townCity: 'Test Town',
          postcode: 'TE1 1ST'
        },
        dependants: []
      };

      mockPrisma.membershipType.findUnique.mockResolvedValue(mockPaidMembershipType);
      mockPrisma.membership.count.mockResolvedValue(0);
      mockPrisma.membership.create.mockResolvedValue(mockAwaitingApprovalMembership);
      mockPrisma.membership.findFirst.mockResolvedValue(null);
      mockPrisma.user.update.mockResolvedValue({ id: 'user-1' });

      await service.processApplication('user-1', 'test@example.com', dto);

      expect(mockPrisma.membership.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            userId: 'user-1',
            deletedAt: null,
            status: { in: [MembershipStatus.PENDING, MembershipStatus.AWAITING_APPROVAL] }
          }),
          data: { status: MembershipStatus.CANCELLED, updatedAt: expect.any(Date) }
        })
      );
    });

    it('updates existing subscription when switching to a cheaper paid plan', async () => {
      const dto: ApplyMembershipDto = {
        membershipTypeId: 'type-cheap',
        fullName: 'Test User',
        phone: '+441234567890',
        address: {
          buildingStreet: '1 Test St',
          locality: 'Test locality',
          townCity: 'Test Town',
          postcode: 'TE1 1ST'
        },
        dependants: []
      };

      mockPrisma.membershipType.findUnique.mockResolvedValue(mockCheapMembershipType);
      mockPrisma.membership.count.mockResolvedValue(0);
      mockPrisma.membership.create.mockResolvedValue(mockCreditMembership);
      mockPrisma.membership.findFirst.mockResolvedValue({
        ...mockActivePaidMembership,
        stripeSubscriptionId: 'sub_test_1',
        stripePriceId: 'price_test_1'
      });
      mockPrisma.membership.findUnique.mockResolvedValue({
        ...mockActivePaidMembership,
        membershipType: mockCheapMembershipType,
        stripeSubscriptionId: 'sub_test_1',
        stripePriceId: 'price_test_1'
      });
      mockPrisma.user.update.mockResolvedValue({ id: 'user-1' });

      const result = await service.processApplication('user-1', 'test@example.com', dto);

      expect(result.paid).toBe(true);
      expect(result.upgraded).toBe(true);
      expect(mockPaymentsService.createSubscriptionCheckout).not.toHaveBeenCalled();
      expect(mockPaymentsService.updateSubscriptionPrice).toHaveBeenCalledWith(
        'sub_test_1',
        'si_test_1',
        mockSyncedPrice.priceId,
        'create_prorations'
      );
      expect(mockPrisma.membership.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: mockActivePaidMembership.id },
          data: expect.objectContaining({
            membershipTypeId: 'type-cheap',
            stripePriceId: mockSyncedPrice.priceId
          })
        })
      );
    });

    it('updates existing subscription when upgrading to a more expensive paid plan', async () => {
      const dto: ApplyMembershipDto = {
        membershipTypeId: 'type-expensive',
        fullName: 'Test User',
        phone: '+441234567890',
        address: {
          buildingStreet: '1 Test St',
          locality: 'Test locality',
          townCity: 'Test Town',
          postcode: 'TE1 1ST'
        },
        dependants: []
      };

      mockPrisma.membershipType.findUnique.mockResolvedValue(mockExpensiveMembershipType);
      mockPrisma.membership.count.mockResolvedValue(0);
      mockPrisma.membership.create.mockResolvedValue(mockPendingMembership);
      mockPrisma.membership.findFirst.mockResolvedValue({
        ...mockActivePaidMembership,
        membershipType: mockPaidMembershipType,
        stripeSubscriptionId: 'sub_test_1',
        stripePriceId: 'price_test_1'
      });
      mockPrisma.membership.findUnique.mockResolvedValue({
        ...mockActivePaidMembership,
        membershipType: mockExpensiveMembershipType,
        stripeSubscriptionId: 'sub_test_1',
        stripePriceId: 'price_test_1'
      });
      mockPrisma.user.update.mockResolvedValue({ id: 'user-1' });

      const result = await service.processApplication('user-1', 'test@example.com', dto);

      expect(result.paid).toBe(true);
      expect(result.upgraded).toBe(true);
      expect(mockPaymentsService.createSubscriptionCheckout).not.toHaveBeenCalled();
      expect(mockPaymentsService.updateSubscriptionPrice).toHaveBeenCalledWith(
        'sub_test_1',
        'si_test_1',
        mockSyncedPrice.priceId,
        'create_prorations'
      );
    });

    it('creates an awaiting-approval membership when the existing paid membership has expired without a subscription', async () => {
      const dto: ApplyMembershipDto = {
        membershipTypeId: 'type-paid',
        fullName: 'Test User',
        phone: '+441234567890',
        address: {
          buildingStreet: '1 Test St',
          locality: 'Test locality',
          townCity: 'Test Town',
          postcode: 'TE1 1ST'
        },
        dependants: []
      };

      mockPrisma.membershipType.findUnique.mockResolvedValue(mockPaidMembershipType);
      mockPrisma.membership.count.mockResolvedValue(0);
      mockPrisma.membership.create.mockResolvedValue(mockAwaitingApprovalMembership);
      mockPrisma.membership.findFirst.mockResolvedValue({
        ...mockActivePaidMembership,
        startDate: new Date(Date.now() - 400 * 24 * 60 * 60 * 1000),
        endDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
        membershipType: mockExpensiveMembershipType,
        stripeSubscriptionId: null,
        stripePriceId: null
      });
      mockPrisma.user.update.mockResolvedValue({ id: 'user-1' });

      await service.processApplication('user-1', 'test@example.com', dto);

      expect(mockPrisma.membership.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: MembershipStatus.AWAITING_APPROVAL
          })
        })
      );
    });
  });

  describe('handleCheckoutSessionCompleted', () => {
    it('records payment for an existing awaiting-approval membership without activating it', async () => {
      mockPrisma.membership.findUnique.mockResolvedValue({
        ...mockAwaitingApprovalMembership,
        stripePriceId: 'price_test_1',
        user: { id: 'user-1', name: 'Test User', email: 'test@example.com' }
      });
      mockPrisma.membership.updateMany.mockResolvedValue({ count: 0 });
      mockPrisma.membership.update.mockResolvedValue({
        ...mockAwaitingApprovalMembership,
        membershipId: 'MEM-ABCDEFGH',
        user: { id: 'user-1', name: 'Test User', email: 'test@example.com' }
      });
      mockPrisma.membership.findFirst.mockResolvedValue({
        ...mockAwaitingApprovalMembership,
        user: { email: 'test@example.com', name: 'Test User' }
      });

      const result = await service.handleCheckoutSessionCompleted({
        id: 'cs_test_123',
        subscription: 'sub_test_1',
        metadata: {
          source: 'membership',
          membershipId: mockAwaitingApprovalMembership.id,
          userId: 'user-1',
          membershipTypeId: 'type-paid',
          fullName: 'Test User',
          address: '',
          phone: '',
          dependants: '[]'
        },
        customer_email: 'test@example.com'
      } as any);

      expect(mockPrisma.membership.updateMany).not.toHaveBeenCalled();
      expect(mockPaymentsService.getSubscription).toHaveBeenCalledWith('sub_test_1');
      expect(mockPrisma.membership.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            paymentMethod: 'stripe',
            subscriptionStatus: 'active'
          })
        })
      );
      expect(result.membershipId).toBe('MEM-ABCDEFGH');
    });

    it('creates a new awaiting-approval membership when membershipId is not provided', async () => {
      mockPrisma.membershipType.findUnique.mockResolvedValue(mockPaidMembershipType);
      mockPrisma.membership.count.mockResolvedValue(0);
      mockPrisma.membership.create.mockResolvedValue(mockCreatedMembership);
      mockPrisma.membership.updateMany.mockResolvedValue({ count: 0 });
      mockPrisma.user.findUnique.mockResolvedValue({ id: 'user-1', name: 'Test User' });
      mockSupabaseStorage.uploadBuffer.mockRejectedValue(new Error('Supabase is not configured'));

      const result = await service.handleCheckoutSessionCompleted({
        id: 'cs_test_123',
        subscription: 'sub_test_1',
        metadata: {
          source: 'membership',
          userId: 'user-1',
          membershipTypeId: 'type-paid',
          fullName: 'Test User',
          address: '',
          phone: '',
          dependants: '[]'
        },
        customer_email: 'test@example.com'
      } as any);

      expect(mockPrisma.membership.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            userId: 'user-1',
            membershipTypeId: 'type-paid',
            status: MembershipStatus.AWAITING_APPROVAL,
            stripeSubscriptionId: 'sub_test_1',
            subscriptionStatus: 'active'
          })
        })
      );
      expect(result.membershipId).toBe(mockCreatedMembership.membershipId);
    });

    it('rejects when the checkout membership belongs to a different user', async () => {
      mockPrisma.membership.findUnique.mockResolvedValue({
        ...mockPendingMembership,
        userId: 'user-2',
        user: { id: 'user-2', name: 'Other User', email: 'other@example.com' }
      });

      await expect(
        service.handleCheckoutSessionCompleted({
          id: 'cs_test_123',
          metadata: {
            source: 'membership',
            membershipId: mockPendingMembership.id,
            userId: 'user-1',
            membershipTypeId: 'type-paid',
            fullName: 'Test User',
            address: '',
            phone: '',
            dependants: '[]'
          },
          customer_email: 'other@example.com'
        } as any)
      ).rejects.toThrow('Membership user mismatch');
    });
  });

  describe('handleSubscriptionUpdated', () => {
    it('updates membership end date and status from the subscription', async () => {
      mockPrisma.membership.findFirst.mockResolvedValue({
        ...mockActivePaidMembership,
        stripeSubscriptionId: 'sub_test_1',
        stripePriceId: 'price_test_1',
        membershipTypeId: 'type-paid'
      });
      mockPrisma.membershipType.findFirst.mockResolvedValue(null);
      mockPrisma.membership.update.mockResolvedValue({} as any);

      const now = Math.floor(Date.now() / 1000);
      const result = await service.handleSubscriptionUpdated({
        id: 'sub_test_1',
        status: 'active',
        current_period_end: now + 365 * 24 * 60 * 60,
        items: { data: [{ id: 'si_test_1', price: { id: 'price_test_1' } }] }
      } as any);

      expect(result.membershipId).toBe(mockActivePaidMembership.membershipId);
      expect(mockPrisma.membership.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: MembershipStatus.ACTIVE,
            endDate: new Date((now + 365 * 24 * 60 * 60) * 1000),
            stripePriceId: 'price_test_1',
            subscriptionStatus: 'active'
          })
        })
      );
    });
  });

  describe('handleSubscriptionDeleted', () => {
    it('cancels the membership when the subscription is deleted', async () => {
      mockPrisma.membership.findFirst.mockResolvedValue({
        ...mockActivePaidMembership,
        stripeSubscriptionId: 'sub_test_1'
      });
      mockPrisma.membership.update.mockResolvedValue({} as any);

      const result = await service.handleSubscriptionDeleted({
        id: 'sub_test_1',
        status: 'canceled'
      } as any);

      expect(result.membershipId).toBe(mockActivePaidMembership.membershipId);
      expect(mockPrisma.membership.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: MembershipStatus.CANCELLED,
            endDate: expect.any(Date),
            subscriptionStatus: 'canceled'
          })
        })
      );
    });
  });

  describe('updateDependants', () => {
    it('updates dependantsJson and regenerates the card for active memberships', async () => {
      const dependantsType = { ...mockMembershipType, features: ['DEPENDANTS'] };
      mockPrisma.membership.findFirst.mockResolvedValue({
        ...mockCreatedMembership,
        membershipType: dependantsType,
        user: { id: 'user-1', name: 'Test User', firstName: 'Test', lastName: 'User', email: 'test@example.com' }
      });
      mockPrisma.membership.update.mockResolvedValue({
        ...mockCreatedMembership,
        membershipType: dependantsType,
        user: { id: 'user-1', name: 'Test User', firstName: 'Test', lastName: 'User', email: 'test@example.com' }
      });
      mockSupabaseStorage.uploadBuffer.mockResolvedValue({ url: 'https://supabase.test/card.png' });

      const newDependants = [{ name: 'Jane Doe', age: 30, relationship: 'spouse' as const }];
      await service.updateDependants('membership-1', newDependants);

      expect(mockPrisma.membership.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'membership-1' },
          data: expect.objectContaining({
            dependantsJson: newDependants
          })
        })
      );
      expect(mockSupabaseStorage.uploadBuffer).toHaveBeenCalled();
    });

    it('throws when the membership type does not support dependants', async () => {
      mockPrisma.membership.findFirst.mockResolvedValue({
        ...mockCreatedMembership,
        membershipType: { ...mockMembershipType, features: [] },
        user: { id: 'user-1', name: 'Test User', firstName: 'Test', lastName: 'User', email: 'test@example.com' }
      });

      await expect(
        service.updateDependants('membership-1', [{ name: 'Jane Doe', age: 30, relationship: 'spouse' as const }])
      ).rejects.toThrow('This membership type does not include dependants');
    });

    it('updates dependants for the current user membership', async () => {
      const dependantsType = { ...mockMembershipType, features: ['DEPENDANTS'] };
      mockPrisma.membership.findFirst
        .mockResolvedValueOnce({
          id: 'membership-1',
          membershipType: dependantsType,
          status: MembershipStatus.ACTIVE
        })
        .mockResolvedValueOnce({
          ...mockCreatedMembership,
          membershipType: dependantsType,
          user: { id: 'user-1', name: 'Test User', firstName: 'Test', lastName: 'User', email: 'test@example.com' }
        });
      mockPrisma.membership.update.mockResolvedValue({
        ...mockCreatedMembership,
        membershipType: dependantsType,
        user: { id: 'user-1', name: 'Test User', firstName: 'Test', lastName: 'User', email: 'test@example.com' }
      });
      mockSupabaseStorage.uploadBuffer.mockResolvedValue({ url: 'https://supabase.test/card.png' });

      const newDependants = [{ name: 'Child One', age: 5, relationship: 'child' as const }];
      await service.updateDependantsForUser('user-1', newDependants);

      expect(mockPrisma.membership.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            dependantsJson: newDependants
          })
        })
      );
    });
  });

  describe('syncMemberRole', () => {
    it('promotes GUEST to MEMBER when an active qualifying membership exists', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({ role: 'GUEST' });
      mockPrisma.membership.findFirst.mockResolvedValue(mockCreatedMembership);
      mockPrisma.user.update.mockResolvedValue({ id: 'user-1', role: 'MEMBER' });
      mockPrisma.authEvent.create.mockResolvedValue({});

      await service.syncMemberRole('user-1');

      expect(mockPrisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'user-1' },
          data: expect.objectContaining({ role: 'MEMBER' })
        })
      );
      expect(mockPrisma.authEvent.create).toHaveBeenCalled();
      expect(mockPrisma.session.updateMany).not.toHaveBeenCalled();
    });

    it('does not promote when the membership type does not grant the member role', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({ role: 'GUEST' });
      // The real query filters by membershipType.grantsMemberRole = true, so a
      // non-granting type returns no qualifying membership.
      mockPrisma.membership.findFirst.mockResolvedValue(null);

      await service.syncMemberRole('user-1');

      expect(mockPrisma.user.update).not.toHaveBeenCalled();
    });

    it('demotes MEMBER to GUEST when no qualifying membership exists and revokes sessions', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({ role: 'MEMBER' });
      mockPrisma.membership.findFirst.mockResolvedValue(null);
      mockPrisma.user.update.mockResolvedValue({ id: 'user-1', role: 'GUEST' });
      mockPrisma.authEvent.create.mockResolvedValue({});

      await service.syncMemberRole('user-1');

      expect(mockPrisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'user-1' },
          data: expect.objectContaining({ role: 'GUEST' })
        })
      );
      expect(mockPrisma.session.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { userId: 'user-1', revokedAt: null },
          data: expect.objectContaining({ revokedReason: 'membership_lapsed' })
        })
      );
      expect(mockPrisma.authEvent.create).toHaveBeenCalled();
    });

    it('does not change ADMIN role', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({ role: 'ADMIN' });

      await service.syncMemberRole('user-1');

      expect(mockPrisma.user.update).not.toHaveBeenCalled();
      expect(mockPrisma.membership.findFirst).not.toHaveBeenCalled();
    });

    it('does not change BUSINESS_OWNER role', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({ role: 'BUSINESS_OWNER' });

      await service.syncMemberRole('user-1');

      expect(mockPrisma.user.update).not.toHaveBeenCalled();
      expect(mockPrisma.membership.findFirst).not.toHaveBeenCalled();
    });
  });
});
