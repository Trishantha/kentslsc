import { Module } from '@nestjs/common';
import { EventsService } from './events.service.js';
import { EventsController, TicketsController } from './events.controller.js';
import { PrismaModule } from '../core/prisma/prisma.module.js';
import { PaymentsModule } from '../payments/payments.module.js';
import { EmailModule } from '../email/email.module.js';

@Module({
  imports: [PrismaModule, PaymentsModule, EmailModule],
  providers: [EventsService],
  controllers: [EventsController, TicketsController],
  exports: [EventsService]
})
export class EventsModule {}
