import { Inject, Injectable, Logger, Optional } from '@nestjs/common';
import { Queue } from 'bullmq';
import { WebhookProcessor } from './webhook.processor.js';
import { WEBHOOK_PROCESSING_QUEUE } from '../queue/queue.constants.js';
import type { WebhookJobData } from '../queue/queue.types.js';

@Injectable()
export class WebhookQueueService {
  private readonly logger = new Logger(WebhookQueueService.name);

  constructor(
    @Inject(WEBHOOK_PROCESSING_QUEUE) @Optional() private readonly queue: Queue<WebhookJobData> | undefined,
    private readonly webhookProcessor: WebhookProcessor
  ) {}

  async addWebhookJob(data: WebhookJobData): Promise<void> {
    if (this.queue) {
      await this.queue.add('process-webhook', data);
      return;
    }

    // Graceful fallback when Redis is not configured.
    try {
      await this.webhookProcessor.process(data);
    } catch (err) {
      this.logger.error(`Synchronous webhook fallback failed: ${err instanceof Error ? err.message : String(err)}`);
      throw err;
    }
  }
}
