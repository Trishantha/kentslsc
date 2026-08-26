import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { MembershipExpiryService } from './membership-expiry.service.js';
import { MembershipStatus } from '@kentslsc/database';

describe('MembershipExpiryService', () => {
  let service: MembershipExpiryService;

  const mockPrisma: any = {
    membership: {
      findMany: jest.fn(),
      updateMany: jest.fn()
    }
  };

  const mockMembershipsService: any = {
    syncMemberRole: jest.fn()
  };

  beforeEach(() => {
    jest.clearAllMocks();
    service = new MembershipExpiryService(mockPrisma, mockMembershipsService);
  });

  it('expires active memberships past their end date and syncs affected users', async () => {
    const now = new Date();
    const expiredMemberships = [
      { id: 'm1', userId: 'user-1', membershipId: 'MEM-1', endDate: new Date(now.getTime() - 1000) },
      { id: 'm2', userId: 'user-2', membershipId: 'MEM-2', endDate: new Date(now.getTime() - 2000) }
    ];
    mockPrisma.membership.findMany.mockResolvedValue(expiredMemberships);
    mockPrisma.membership.updateMany.mockResolvedValue({ count: 2 });

    await service.expireMemberships();

    expect(mockPrisma.membership.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          deletedAt: null,
          status: MembershipStatus.ACTIVE,
          endDate: { lt: expect.any(Date) }
        })
      })
    );
    expect(mockPrisma.membership.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: { in: ['m1', 'm2'] } },
        data: expect.objectContaining({ status: MembershipStatus.EXPIRED })
      })
    );
    expect(mockMembershipsService.syncMemberRole).toHaveBeenCalledWith('user-1');
    expect(mockMembershipsService.syncMemberRole).toHaveBeenCalledWith('user-2');
  });

  it('does nothing when there are no expired memberships', async () => {
    mockPrisma.membership.findMany.mockResolvedValue([]);

    await service.expireMemberships();

    expect(mockPrisma.membership.updateMany).not.toHaveBeenCalled();
    expect(mockMembershipsService.syncMemberRole).not.toHaveBeenCalled();
  });

  it('continues syncing users even if one sync fails', async () => {
    const now = new Date();
    const expiredMemberships = [
      { id: 'm1', userId: 'user-1', membershipId: 'MEM-1', endDate: new Date(now.getTime() - 1000) },
      { id: 'm2', userId: 'user-2', membershipId: 'MEM-2', endDate: new Date(now.getTime() - 2000) }
    ];
    mockPrisma.membership.findMany.mockResolvedValue(expiredMemberships);
    mockPrisma.membership.updateMany.mockResolvedValue({ count: 2 });
    mockMembershipsService.syncMemberRole
      .mockRejectedValueOnce(new Error('sync failed'))
      .mockResolvedValue(undefined);

    await service.expireMemberships();

    expect(mockMembershipsService.syncMemberRole).toHaveBeenCalledWith('user-1');
    expect(mockMembershipsService.syncMemberRole).toHaveBeenCalledWith('user-2');
  });
});
