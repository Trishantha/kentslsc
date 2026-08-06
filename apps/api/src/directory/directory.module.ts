import { Module } from '@nestjs/common';
import { PrismaModule } from '../core/prisma/prisma.module.js';
import { AiModule } from '../ai/ai.module.js';
import { PaymentsModule } from '../payments/payments.module.js';
import { DirectoryService } from './directory.service.js';
import { DirectoryController } from './directory.controller.js';

@Module({
  imports: [PrismaModule, AiModule, PaymentsModule],
  providers: [DirectoryService],
  controllers: [DirectoryController],
  exports: [DirectoryService]
})
export class DirectoryModule {}
