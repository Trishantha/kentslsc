import { Inject, Injectable, Logger, OnModuleDestroy, OnModuleInit, Optional } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Worker, type Job } from 'bullmq';
import type Redis from 'ioredis';
import { WebhookProcessor } from './webhook.processor.js';
import type { EnvConfig } from '../core/config/env.validation.js';
import { REDIS_CONNECTION, WEBHOOK_PROCESSING_QUEUE } from '../queue/queue.constants.js';
import type { WebhookJobData } from '../queue/queue.types.js';

@Injectable()
export class WebhookWorkerService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(WebhookWorkerService.name);
  private worker?: Worker;

  constructor(
    @Inject(REDIS_CONNECTION) @Optional() private readonly redis: Redis | undefined,
    private readonly configService: ConfigService<EnvConfig, true>,
    private readonly webhookProcessor: WebhookProcessor
  ) {}

  onModuleInit() {
    if (!this.redis) {
      this.logger.log('Redis not configured; webhook worker disabled. Webhooks will run synchronously.');
      return;
    }

    const concurrency = this.configService.get('QUEUE_CONCURRENCY', { infer: true });
    this.worker = new Worker(
      WEBHOOK_PROCESSING_QUEUE,
      async (job: Job<WebhookJobData>) => this.webhookProcessor.process(job.data),
      { connection: this.redis, concurrency }
    );
    this.worker.on('failed', (job, error) => {
      this.logger.error(`Webhook job ${job?.id ?? 'unknown'} failed: ${error.message}`, error);
    });
    this.worker.on('error', (error) => {
      this.logger.error(`Webhook worker error: ${error.message}`, error);
    });
    this.logger.log(`Started webhook worker with concurrency ${concurrency}`);
  }

  async onModuleDestroy() {
    if (this.worker) {
      await this.worker.close();
    }
  }
}
