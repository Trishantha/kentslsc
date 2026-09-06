import { Logger, Module, Global } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Queue } from 'bullmq';
import Redis from 'ioredis';
import type { EnvConfig } from '../core/config/env.validation.js';
import { QueueLifecycleService } from './queue-lifecycle.service.js';
import { REDIS_CONNECTION, SEND_EMAIL_QUEUE, WEBHOOK_PROCESSING_QUEUE } from './queue.constants.js';

const logger = new Logger('QueueModule');

function createQueue(name: string) {
  return {
    provide: name,
    useFactory: (redis: Redis | undefined) => {
      return redis
        ? new Queue(name, {
            connection: redis,
            defaultJobOptions: {
              attempts: 5,
              backoff: { type: 'exponential', delay: 1_000 },
              removeOnComplete: { age: 86_400, count: 1_000 },
              removeOnFail: { age: 604_800, count: 5_000 }
            }
          })
        : undefined;
    },
    inject: [REDIS_CONNECTION]
  };
}

/**
 * Shared queue infrastructure. This module does not contain domain processors;
 * it only exposes the Redis connection and BullMQ Queue instances so that other
 * modules can create their own workers and enqueue jobs. When Redis is not
 * configured or unreachable, the Redis connection is undefined and callers fall
 * back to synchronous handlers.
 */
@Global()
@Module({
  providers: [
    {
      provide: REDIS_CONNECTION,
      useFactory: async (config: ConfigService<EnvConfig, true>) => {
        const redisUrl = config.get('REDIS_URL', { infer: true });
        const enabled = config.get('QUEUE_ENABLED', { infer: true }) !== 'false';
        if (!redisUrl || !enabled) {
          return undefined;
        }

        const redis = new Redis(redisUrl, {
          maxRetriesPerRequest: null,
          enableReadyCheck: false,
          lazyConnect: true
        });

        // Without an error listener ioredis prints "Unhandled error event"
        // (with a full stack) every time a connection attempt fails, which
        // surfaces as a scary startup error on hosts where Redis is
        // unreachable. The initial failure is reported once by the catch
        // below; only errors after a successful connect are logged here.
        let suppressConnectionErrors = true;
        redis.on('error', (error: Error) => {
          if (!suppressConnectionErrors) {
            logger.warn(`Redis connection error: ${error.message}`);
          }
        });

        try {
          await redis.connect();
          suppressConnectionErrors = false;
          logger.log('Redis connected; queues enabled.');
          return redis;
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          logger.warn(`Redis connection failed; queues disabled. ${message}`);
          try {
            redis.disconnect();
          } catch {
            // ignore cleanup errors
          }
          return undefined;
        }
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
