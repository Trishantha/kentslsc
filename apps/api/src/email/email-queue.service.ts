import { Injectable, Logger, Optional } from '@nestjs/common';
import { Queue } from 'bullmq';
import { EmailProcessor } from './email.processor.js';
import { SEND_EMAIL_QUEUE } from '../queue/queue.constants.js';
import type { SendTicketEmailJobData } from '../queue/queue.types.js';
import { Inject } from '@nestjs/common';

@Injectable()
export class EmailQueueService {
  private readonly logger = new Logger(EmailQueueService.name);

  constructor(
    @Inject(SEND_EMAIL_QUEUE) @Optional() private readonly queue: Queue<SendTicketEmailJobData> | undefined,
    private readonly emailProcessor: EmailProcessor
  ) {}

  async addSendTicketEmailJob(data: SendTicketEmailJobData): Promise<void> {
    if (this.queue) {
      await this.queue.add('send-ticket-email', data);
      return;
    }

    // Graceful fallback when Redis is not configured.
    try {
      await this.emailProcessor.process(data);
    } catch (err) {
      this.logger.error(`Synchronous email fallback failed: ${err instanceof Error ? err.message : String(err)}`);
      throw err;
    }
  }
}
