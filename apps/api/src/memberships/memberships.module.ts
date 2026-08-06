import { Module } from '@nestjs/common';
import { MembershipsService } from './memberships.service.js';
import { MembershipsController } from './memberships.controller.js';
import { PrismaModule } from '../core/prisma/prisma.module.js';
import { PaymentsModule } from '../payments/payments.module.js';
import { EmailModule } from '../email/email.module.js';
import { AiModule } from '../ai/ai.module.js';

@Module({
  imports: [PrismaModule, PaymentsModule, EmailModule, AiModule],
  providers: [MembershipsService],
  controllers: [MembershipsController],
  exports: [MembershipsService]
})
export class MembershipsModule {}
