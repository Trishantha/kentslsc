import { Inject, Injectable, Logger, Optional } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { TicketStatus } from '@kentslsc/database';
import crypto from 'crypto';
import type Redis from 'ioredis';
import { PrismaService } from '../core/prisma/prisma.service.js';
import { REDIS_CONNECTION } from '../queue/queue.constants.js';

@Injectable()
export class TicketExpiryService {
  private readonly logger = new Logger(TicketExpiryService.name);

  constructor(
    private readonly prisma: PrismaService,
    @Inject(REDIS_CONNECTION) @Optional() private readonly redis?: Redis
  ) {}

  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async expireTickets(): Promise<void> {
    const lockToken = await this.acquireLock('kentslsc:automation:ticket-expiry', 55 * 60_000);
    if (!lockToken) return;
    const now = new Date();
    try {
      const expiredTickets = await this.prisma.ticket.findMany({
        where: {
          deletedAt: null,
          status: TicketStatus.VALID,
          event: { endDatetime: { lt: now } }
        },
        select: { id: true, eventId: true }
      });

      if (expiredTickets.length === 0) return;

      const ids = expiredTickets.map((t) => t.id);
      await this.prisma.ticket.updateMany({
        where: { id: { in: ids } },
        data: { status: TicketStatus.EXPIRED, updatedAt: now }
      });

      this.logger.log(
        `Expired ${expiredTickets.length} unused ticket(s) across ${new Set(expiredTickets.map((t) => t.eventId)).size} ended event(s)`
      );
    } finally {
      await this.releaseLock('kentslsc:automation:ticket-expiry', lockToken);
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
