import { Inject, Injectable, Logger, Optional } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { FacebookService } from './facebook.service.js';
import crypto from 'crypto';
import type Redis from 'ioredis';
import { REDIS_CONNECTION } from '../queue/queue.constants.js';

@Injectable()
export class FacebookSyncService {
  private readonly logger = new Logger(FacebookSyncService.name);

  constructor(
    private readonly facebookService: FacebookService,
    @Inject(REDIS_CONNECTION) @Optional() private readonly redis?: Redis
  ) {}

  @Cron(CronExpression.EVERY_HOUR)
  async scheduledSync(): Promise<void> {
    if (!this.facebookService.isConfigured()) {
      return;
    }
    const key = 'kentslsc:automation:facebook-sync';
    const token = crypto.randomUUID();
    if (this.redis && (await this.redis.set(key, token, 'PX', 55 * 60_000, 'NX')) !== 'OK') return;

    try {
      await this.facebookService.sync();
    } catch (error) {
      this.logger.warn(
        `Scheduled Facebook sync failed: ${error instanceof Error ? error.message : String(error)}`
      );
    } finally {
      if (this.redis) {
        await this.redis.eval(
          "if redis.call('get', KEYS[1]) == ARGV[1] then return redis.call('del', KEYS[1]) else return 0 end",
          1,
          key,
          token
        );
      }
    }
  }
}
