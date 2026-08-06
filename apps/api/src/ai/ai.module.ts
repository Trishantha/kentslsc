import { Module } from '@nestjs/common';
import { PrismaModule } from '../core/prisma/prisma.module.js';
import { AiService } from './ai.service.js';
import { AiController } from './ai.controller.js';

@Module({
  imports: [PrismaModule],
  providers: [AiService],
  controllers: [AiController],
  exports: [AiService]
})
export class AiModule {}
