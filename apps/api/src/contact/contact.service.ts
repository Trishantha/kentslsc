import { Injectable } from '@nestjs/common';
import { PrismaService } from '../core/prisma/prisma.service.js';
import { EmailService } from '../email/email.service.js';
import { AiService } from '../ai/ai.service.js';
import { CreateContactMessageDto } from './dto/create-contact-message.dto.js';

@Injectable()
export class ContactService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly emailService: EmailService,
    private readonly aiService: AiService
  ) {}

  async create(dto: CreateContactMessageDto) {
    const aiFaqResponse = await this.aiService
      .answerFaq(`${dto.subject}\n\n${dto.message}`)
      .catch(() => null);

    const message = await this.prisma.contactMessage.create({
      data: {
        name: dto.name,
        email: dto.email,
        phone: dto.phone ?? null,
        subject: dto.subject,
        message: dto.message,
        aiFaqResponse
      }
    });

    await this.emailService.sendContactConfirmation(dto.email, dto.name).catch(() => undefined);

    return message;
  }
}
