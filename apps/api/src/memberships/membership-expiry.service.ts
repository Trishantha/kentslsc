import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { MembershipStatus } from '@kentslsc/database';
import { PrismaService } from '../core/prisma/prisma.service.js';
import { MembershipsService } from './memberships.service.js';

@Injectable()
export class MembershipExpiryService {
  private readonly logger = new Logger(MembershipExpiryService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly membershipsService: MembershipsService
  ) {}

  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async expireMemberships(): Promise<void> {
    const now = new Date();
    const expiredMemberships = await this.prisma.membership.findMany({
      where: {
        deletedAt: null,
        status: MembershipStatus.ACTIVE,
        endDate: { lt: now }
      },
      select: {
        id: true,
        userId: true,
        membershipId: true,
        endDate: true
      }
    });

    if (expiredMemberships.length === 0) {
      return;
    }

    const ids = expiredMemberships.map((m) => m.id);
    await this.prisma.membership.updateMany({
      where: { id: { in: ids } },
      data: { status: MembershipStatus.EXPIRED, updatedAt: now }
    });

    const userIds = [...new Set(expiredMemberships.map((m) => m.userId))];
    for (const userId of userIds) {
      try {
        await this.membershipsService.syncMemberRole(userId);
      } catch (err) {
        this.logger.warn(
          `Failed to sync member role for user ${userId} after expiry: ${(err as Error).message}`
        );
      }
    }

    this.logger.log(
      `Expired ${expiredMemberships.length} membership(s) and synced roles for ${userIds.length} user(s)`
    );
  }
}
