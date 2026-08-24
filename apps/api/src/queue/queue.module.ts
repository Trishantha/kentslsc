import { Module, Global } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Queue } from 'bullmq';
import Redis from 'ioredis';
import type { EnvConfig } from '../core/config/env.validation.js';
import { QueueLifecycleService } from './queue-lifecycle.service.js';
import { REDIS_CONNECTION, SEND_EMAIL_QUEUE, WEBHOOK_PROCESSING_QUEUE } from './queue.constants.js';

function createQueue(name: string) {
  return {
    provide: name,
    useFactory: (redis: Redis | undefined) => {
      return redis ? new Queue(name, { connection: redis }) : undefined;
    },
    inject: [REDIS_CONNECTION]
  };
}

/**
 * Shared queue infrastructure. This module does not contain domain processors;
 * it only exposes the Redis connection and BullMQ Queue instances so that other
 * modules can create their own workers and enqueue jobs. When Redis is not
 * configured, queues are undefined and callers fall back to synchronous handlers.
 */
@Global()
@Module({
  providers: [
    {
      provide: REDIS_CONNECTION,
      useFactory: (config: ConfigService<EnvConfig, true>) => {
        const redisUrl = config.get('REDIS_URL', { infer: true });
        const enabled = config.get('QUEUE_ENABLED', { infer: true }) !== 'false';
        return redisUrl && enabled
          ? new Redis(redisUrl, { maxRetriesPerRequest: null, enableReadyCheck: false })
          : undefined;
      },
      inject: [ConfigService]
    },
    createQueue(SEND_EMAIL_QUEUE),
    createQueue(WEBHOOK_PROCESSING_QUEUE),
    QueueLifecycleService
  ],
  exports: [REDIS_CONNECTION, SEND_EMAIL_QUEUE, WEBHOOK_PROCESSING_QUEUE]
})
export class QueueModule {}
