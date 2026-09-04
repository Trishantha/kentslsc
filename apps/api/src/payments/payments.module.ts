import { Module } from '@nestjs/common';
import { PrismaModule } from '../core/prisma/prisma.module.js';
import { EmailModule } from '../email/email.module.js';
import { PaymentsService } from './payments.service.js';
import { GoCardlessService } from './gocardless.service.js';
import { PaymentsController } from './payments.controller.js';
import { RefundsService } from './refunds.service.js';
import { PaymentReportsService } from './reports.service.js';

export const PAYMENTS_SERVICE = 'PAYMENTS_SERVICE';

@Module({
  imports: [PrismaModule, EmailModule],
  providers: [
    PaymentsService,
    GoCardlessService,
    RefundsService,
    PaymentReportsService,
    { provide: PAYMENTS_SERVICE, useClass: PaymentsService }
  ],
  controllers: [PaymentsController],
  exports: [PaymentsService, GoCardlessService, RefundsService, PaymentReportsService, PAYMENTS_SERVICE]
})
export class PaymentsModule {}
