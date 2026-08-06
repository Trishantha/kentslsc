import { Module } from '@nestjs/common';
import { PrismaModule } from '../core/prisma/prisma.module.js';
import { EmailModule } from '../email/email.module.js';
import { AiModule } from '../ai/ai.module.js';
import { ContactService } from './contact.service.js';
import { ContactController } from './contact.controller.js';

@Module({
  imports: [PrismaModule, EmailModule, AiModule],
  providers: [ContactService],
  controllers: [ContactController]
})
export class ContactModule {}
