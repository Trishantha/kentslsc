import { Module } from '@nestjs/common';
import { PrismaModule } from '../core/prisma/prisma.module.js';
import { PaymentsModule } from '../payments/payments.module.js';
import { EmailModule } from '../email/email.module.js';
import { AuthorizationModule } from '../authorization/authorization.module.js';
import { DirectoryService } from './directory.service.js';
import { DirectoryController } from './directory.controller.js';

@Module({
  imports: [PrismaModule, PaymentsModule, EmailModule, AuthorizationModule],
  providers: [DirectoryService],
  controllers: [DirectoryController],
  exports: [DirectoryService]
})
export class DirectoryModule {}
