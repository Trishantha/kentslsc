import { Injectable, Logger, OnModuleDestroy, OnModuleInit, Optional } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Worker, type Job } from 'bullmq';
import type Redis from 'ioredis';
import { EmailProcessor } from './email.processor.js';
import type { EnvConfig } from '../core/config/env.validation.js';
import { REDIS_CONNECTION, SEND_EMAIL_QUEUE } from '../queue/queue.constants.js';
import type { SendTicketEmailJobData } from '../queue/queue.types.js';
import { Inject } from '@nestjs/common';

@Injectable()
export class EmailWorkerService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(EmailWorkerService.name);
  private worker?: Worker;

  constructor(
    @Inject(REDIS_CONNECTION) @Optional() private readonly redis: Redis | undefined,
    private readonly configService: ConfigService<EnvConfig, true>,
    private readonly emailProcessor: EmailProcessor
  ) {}

  onModuleInit() {
    if (!this.redis) {
      this.logger.log('Redis not configured; email worker disabled. Emails will run synchronously.');
      return;
    }

    const concurrency = this.configService.get('QUEUE_CONCURRENCY', { infer: true });
    this.worker = new Worker(
      SEND_EMAIL_QUEUE,
      async (job: Job<SendTicketEmailJobData>) => this.emailProcessor.process(job.data),
      { connection: this.redis, concurrency }
    );
    this.worker.on('failed', (job, error) => {
      this.logger.error(`Email job ${job?.id ?? 'unknown'} failed: ${error.message}`, error);
    });
    this.worker.on('error', (error) => {
      this.logger.error(`Email worker error: ${error.message}`, error);
    });
    this.logger.log(`Started email worker with concurrency ${concurrency}`);
  }

  async onModuleDestroy() {
    if (this.worker) {
      await this.worker.close();
    }
  }
}
