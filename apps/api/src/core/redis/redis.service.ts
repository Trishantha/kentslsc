import { Inject, Injectable, OnModuleDestroy, Logger } from '@nestjs/common';
import Redis from 'ioredis';

@Injectable()
export class RedisService implements OnModuleDestroy {
  private readonly logger = new Logger(RedisService.name);

  constructor(@Inject('REDIS_CLIENT') private readonly redis: Redis) {}

  get client(): Redis {
    return this.redis;
  }

  async get<T>(key: string): Promise<T | null> {
    const value = await this.redis.get(key);
    return value ? (JSON.parse(value) as T) : null;
  }

  async set<T>(key: string, value: T, ttlSeconds?: number): Promise<void> {
    const serialized = JSON.stringify(value);
    if (ttlSeconds) {
      await this.redis.setex(key, ttlSeconds, serialized);
    } else {
      await this.redis.set(key, serialized);
    }
  }

  async del(key: string): Promise<void> {
    await this.redis.del(key);
  }

  async onModuleDestroy() {
    try {
      if (this.redis.status === 'ready' || this.redis.status === 'connect') {
        await this.redis.quit();
        this.logger.log('Redis connection closed.');
      } else {
        this.redis.disconnect();
      }
    } catch (error) {
      this.logger.warn(`Error closing Redis connection: ${(error as Error).message}`);
    }
  }
}
