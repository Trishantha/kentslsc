import { Injectable } from '@nestjs/common';
import { RedisService } from '../redis/redis.service.js';

@Injectable()
export class RedisThrottlerStorage {
  constructor(private readonly redis: RedisService) {}

  async increment(
    key: string,
    ttl: number,
    limit: number,
    blockDuration: number
  ) {
    const redis = this.redis.client;
    const ttlMs = ttl * 1000;
    const blockKey = `${key}:block`;

    const pipeline = redis.pipeline();
    pipeline.incr(key);
    pipeline.pexpire(key, ttlMs);
    const results = await pipeline.exec();
    const totalHits = (results?.[0]?.[1] as number) ?? 1;
    const timeToExpire = await redis.pttl(key);

    let isBlocked = false;
    let timeToBlockExpire = 0;

    if (totalHits > limit && blockDuration > 0) {
      await redis.psetex(blockKey, blockDuration * 1000, '1');
    }

    const blockTtl = await redis.pttl(blockKey);
    if (blockTtl > 0) {
      isBlocked = true;
      timeToBlockExpire = blockTtl;
    }

    return {
      totalHits,
      timeToExpire,
      isBlocked,
      timeToBlockExpire
    };
  }
}
