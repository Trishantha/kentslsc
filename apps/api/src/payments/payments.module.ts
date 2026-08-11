import { Module } from '@nestjs/common';
import { PrismaModule } from '../core/prisma/prisma.module.js';
import { PaymentsService } from './payments.service.js';
import { PaymentsController } from './payments.controller.js';

export const PAYMENTS_SERVICE = 'PAYMENTS_SERVICE';

@Module({
  imports: [PrismaModule],
  providers: [
    PaymentsService,
    { provide: PAYMENTS_SERVICE, useClass: PaymentsService }
  ],
  controllers: [PaymentsController],
  exports: [PaymentsService, PAYMENTS_SERVICE]
})
export class PaymentsModule {}
