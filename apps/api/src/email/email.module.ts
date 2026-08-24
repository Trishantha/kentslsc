import { Module } from '@nestjs/common';
import { QueueModule } from '../queue/queue.module.js';
import { EmailService } from './email.service.js';
import { EmailProcessor } from './email.processor.js';
import { EmailWorkerService } from './email-worker.service.js';
import { EmailQueueService } from './email-queue.service.js';

@Module({
  imports: [QueueModule],
  providers: [EmailService, EmailProcessor, EmailWorkerService, EmailQueueService],
  exports: [EmailService, EmailQueueService]
})
export class EmailModule {}
