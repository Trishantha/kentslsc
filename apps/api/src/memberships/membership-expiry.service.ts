import { Inject, Injectable, Logger, Optional } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { MembershipStatus } from '@kentslsc/database';
import crypto from 'crypto';
import type Redis from 'ioredis';
import { PrismaService } from '../core/prisma/prisma.service.js';
import { MembershipsService } from './memberships.service.js';
import { REDIS_CONNECTION } from '../queue/queue.constants.js';

@Injectable()
export class MembershipExpiryService {
  private readonly logger = new Logger(MembershipExpiryService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly membershipsService: MembershipsService,
    @Inject(REDIS_CONNECTION) @Optional() private readonly redis?: Redis
  ) {}

  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async expireMemberships(): Promise<void> {
    const lockToken = await this.acquireLock('kentslsc:automation:membership-expiry', 55 * 60_000);
    if (!lockToken) return;
    const now = new Date();
    try {
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

      if (expiredMemberships.length === 0) return;

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
    } finally {
      await this.releaseLock('kentslsc:automation:membership-expiry', lockToken);
    }
  }

  private async acquireLock(key: string, ttl: number): Promise<string | null> {
    if (!this.redis) return crypto.randomUUID();
    const token = crypto.randomUUID();
    return (await this.redis.set(key, token, 'PX', ttl, 'NX')) === 'OK' ? token : null;
  }

  private async releaseLock(key: string, token: string): Promise<void> {
    if (!this.redis) return;
    await this.redis.eval(
      "if redis.call('get', KEYS[1]) == ARGV[1] then return redis.call('del', KEYS[1]) else return 0 end",
      1,
      key,
      token
    );
  }
}
