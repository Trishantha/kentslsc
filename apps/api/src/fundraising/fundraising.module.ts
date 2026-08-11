import { Module } from '@nestjs/common';
import { FundraisingService } from './fundraising.service.js';
import { FundraisingController } from './fundraising.controller.js';
import { PaymentsModule } from '../payments/payments.module.js';
import { AiModule } from '../ai/ai.module.js';
import { EmailModule } from '../email/email.module.js';

@Module({
  imports: [PaymentsModule, AiModule, EmailModule],
  providers: [FundraisingService],
  controllers: [FundraisingController],
  exports: [FundraisingService]
})
export class FundraisingModule {}
