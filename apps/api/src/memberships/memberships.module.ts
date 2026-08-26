import { Module } from '@nestjs/common';
import { MembershipsService } from './memberships.service.js';
import { MembershipsController } from './memberships.controller.js';
import { MembershipExpiryService } from './membership-expiry.service.js';
import { PrismaModule } from '../core/prisma/prisma.module.js';
import { PaymentsModule } from '../payments/payments.module.js';
import { EmailModule } from '../email/email.module.js';
import { AiModule } from '../ai/ai.module.js';
import { AuthorizationModule } from '../authorization/authorization.module.js';

@Module({
  imports: [PrismaModule, PaymentsModule, EmailModule, AiModule, AuthorizationModule],
  providers: [MembershipsService, MembershipExpiryService],
  controllers: [MembershipsController],
  exports: [MembershipsService]
})
export class MembershipsModule {}
