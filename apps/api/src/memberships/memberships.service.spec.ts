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

const mockCheckoutResult = {
  id: 'cs_test_123',
  url: 'https://checkout.stripe.test/pay',
  provider: 'stripe'
};

describe('MembershipsService', () => {
  let service: MembershipsService;

  const mockPrisma: any = {
    membershipType: {
      findUnique: jest.fn()
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
    }
  };

  const mockPaymentsService: any = {
    createCheckout: (jest.fn() as jest.Mock<(...args: any[]) => Promise<any>>).mockResolvedValue(mockCheckoutResult)
  };

  const mockEmailService: any = {
    send: (jest.fn() as jest.Mock<(...args: any[]) => Promise<any>>).mockResolvedValue(undefined)
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

  beforeEach(() => {
    jest.clearAllMocks();
    service = new MembershipsService(
      mockPrisma,
      mockPaymentsService,
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
            status: { in: [MembershipStatus.ACTIVE, MembershipStatus.PENDING] }
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

    it('creates a pending membership for paid types and includes membershipId in checkout metadata', async () => {
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
      mockPrisma.membership.create.mockResolvedValue(mockPendingMembership);
      mockPrisma.user.update.mockResolvedValue({ id: 'user-1' });

      const result = await service.processApplication('user-1', 'test@example.com', dto);

      expect(result).toEqual({
        sessionId: mockCheckoutResult.id,
        url: mockCheckoutResult.url,
        paid: true,
        provider: mockCheckoutResult.provider
      });
      expect(mockPrisma.membership.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            userId: 'user-1',
            membershipTypeId: 'type-paid',
            status: MembershipStatus.PENDING
          })
        })
      );
      expect(mockPaymentsService.createCheckout).toHaveBeenCalledWith(
        expect.objectContaining({
          metadata: expect.objectContaining({
            source: 'membership',
            membershipId: mockPendingMembership.id,
            userId: 'user-1',
            membershipTypeId: 'type-paid'
          })
        })
      );
    });

    it('cancels previous pending memberships when re-applying for a paid type', async () => {
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
      mockPrisma.membership.create.mockResolvedValue(mockPendingMembership);
      mockPrisma.user.update.mockResolvedValue({ id: 'user-1' });

      await service.processApplication('user-1', 'test@example.com', dto);

      expect(mockPrisma.membership.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            userId: 'user-1',
            deletedAt: null,
            status: MembershipStatus.PENDING
          }),
          data: { status: MembershipStatus.CANCELLED, updatedAt: expect.any(Date) }
        })
      );
    });
  });

  describe('handleCheckoutSessionCompleted', () => {
    it('activates an existing pending membership when membershipId is provided', async () => {
      mockPrisma.membership.findUnique.mockResolvedValue({
        ...mockPendingMembership,
        user: { id: 'user-1', name: 'Test User', email: 'test@example.com' }
      });
      mockPrisma.membership.updateMany.mockResolvedValue({ count: 0 });
      mockPrisma.membership.update.mockResolvedValue({
        ...mockPendingMembership,
        status: MembershipStatus.ACTIVE,
        membershipId: 'MEM-ABCDEFGH',
        user: { id: 'user-1', name: 'Test User', email: 'test@example.com' }
      });
      mockPrisma.membership.findFirst.mockResolvedValue({
        ...mockPendingMembership,
        user: { email: 'test@example.com', name: 'Test User' }
      });

      const result = await service.handleCheckoutSessionCompleted({
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
        customer_email: 'test@example.com'
      } as any);

      expect(mockPrisma.membership.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            userId: 'user-1',
            deletedAt: null,
            status: { in: [MembershipStatus.ACTIVE, MembershipStatus.PENDING] }
          })
        })
      );
      expect(result.membershipId).toBe('MEM-ABCDEFGH');
    });

    it('creates a new active membership when membershipId is not provided', async () => {
      mockPrisma.membershipType.findUnique.mockResolvedValue(mockPaidMembershipType);
      mockPrisma.membership.count.mockResolvedValue(0);
      mockPrisma.membership.create.mockResolvedValue(mockCreatedMembership);
      mockPrisma.membership.updateMany.mockResolvedValue({ count: 0 });
      mockPrisma.user.findUnique.mockResolvedValue({ id: 'user-1', name: 'Test User' });
      mockSupabaseStorage.uploadBuffer.mockRejectedValue(new Error('Supabase is not configured'));

      const result = await service.handleCheckoutSessionCompleted({
        id: 'cs_test_123',
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
            status: MembershipStatus.ACTIVE
          })
        })
      );
      expect(result.membershipId).toBe(mockCreatedMembership.membershipId);
    });
  });
});
