import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import { RedisService } from './redis.service.js';
import { RedisThrottlerStorage } from '../throttler/redis-throttler.storage.js';

export const REDIS_CLIENT = 'REDIS_CLIENT';

const redisFactory = {
  provide: 'REDIS_CLIENT',
  useFactory: (configService: ConfigService) => {
    return new Redis(configService.getOrThrow<string>('REDIS_URL'));
  },
  inject: [ConfigService]
};

@Global()
@Module({
  providers: [redisFactory, RedisService, RedisThrottlerStorage],
  exports: [redisFactory, RedisService, RedisThrottlerStorage]
})
export class RedisModule {}
