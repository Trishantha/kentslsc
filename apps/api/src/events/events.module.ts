import { Module } from '@nestjs/common';
import { EventsService } from './events.service.js';
import { EventsController, TicketsController } from './events.controller.js';
import { PrismaModule } from '../core/prisma/prisma.module.js';
import { PaymentsModule } from '../payments/payments.module.js';
import { EmailModule } from '../email/email.module.js';
import { AuthorizationModule } from '../authorization/authorization.module.js';

@Module({
  imports: [PrismaModule, PaymentsModule, EmailModule, AuthorizationModule],
  providers: [EventsService],
  controllers: [EventsController, TicketsController],
  exports: [EventsService]
})
export class EventsModule {}
