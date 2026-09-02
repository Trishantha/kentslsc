import { Inject, Injectable, OnModuleDestroy, Optional } from '@nestjs/common';
import type Redis from 'ioredis';
import { REDIS_CONNECTION } from './queue.constants.js';

@Injectable()
export class QueueLifecycleService implements OnModuleDestroy {
  constructor(@Inject(REDIS_CONNECTION) @Optional() private readonly redis: Redis | undefined) {}

  async onModuleDestroy() {
    if (this.redis) {
      await this.redis.quit();
    }
  }
}
