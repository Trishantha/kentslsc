import { Injectable, Logger } from '@nestjs/common';
import { EmailService } from './email.service.js';
import type { SendTicketEmailJobData } from '../queue/queue.types.js';

@Injectable()
export class EmailProcessor {
  private readonly logger = new Logger(EmailProcessor.name);

  constructor(private readonly emailService: EmailService) {}

  async process(data: SendTicketEmailJobData): Promise<void> {
    try {
      await this.emailService.sendTicket(data.email, data.eventTitle, data.cardUrl, data.tickets);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.error(`Failed to send ticket email to ${data.email}: ${message}`);
      throw err;
    }
  }
}
