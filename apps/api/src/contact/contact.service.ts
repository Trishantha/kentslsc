import {
  BadRequestException,
  Injectable,
  Logger,
  ServiceUnavailableException
} from '@nestjs/common';
import { PrismaService } from '../core/prisma/prisma.service.js';
import { EmailService } from '../email/email.service.js';
import { AiService } from '../ai/ai.service.js';
import { SiteSettingsService } from '../site-settings/site-settings.service.js';
import { CreateContactMessageDto } from './dto/create-contact-message.dto.js';

@Injectable()
export class ContactService {
  private readonly logger = new Logger(ContactService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly emailService: EmailService,
    private readonly aiService: AiService,
    private readonly siteSettingsService: SiteSettingsService
  ) {}

  async create(dto: CreateContactMessageDto) {
    // Honeypot: bots often fill this invisible field; humans never see it.
    if (dto.website && dto.website.trim().length > 0) {
      throw new BadRequestException('Invalid request');
    }

    if (!dto.consent) {
      throw new BadRequestException('You must accept the privacy policy to send a message.');
    }

    const aiFaqResponse = await this.aiService
      .answerFaq(`${dto.subject}\n\n${dto.message}`)
      .catch(() => null);

    try {
      const message = await this.prisma.contactMessage.create({
        data: {
          name: dto.name,
          email: dto.email,
          phone: dto.phone ?? null,
          subject: dto.subject,
          message: dto.message,
          consent: dto.consent,
          aiFaqResponse
        }
      });

      const settings = await this.siteSettingsService.get().catch(() => null);
      const adminEmail = settings?.email ?? null;
      const emailErrors: string[] = [];

      await this.emailService.sendContactConfirmation(dto.email, dto.name).catch((err) => {
        const errorMessage = err instanceof Error ? err.message : String(err);
        this.logger.warn(`Failed to send contact confirmation to ${dto.email}: ${errorMessage}`);
        emailErrors.push(`confirmation: ${errorMessage}`);
      });

      if (adminEmail) {
        await this.emailService
          .sendContactNotification(adminEmail, {
            name: dto.name,
            email: dto.email,
            phone: dto.phone ?? null,
            subject: dto.subject,
            message: dto.message
          })
          .catch((err) => {
            const errorMessage = err instanceof Error ? err.message : String(err);
            this.logger.warn(`Failed to send contact notification to ${adminEmail}: ${errorMessage}`);
            emailErrors.push(`notification: ${errorMessage}`);
          });
      }

      return { ...message, emailErrors };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const code =
        error && typeof error === 'object' && 'code' in error ? String(error.code) : undefined;
      const meta =
        error && typeof error === 'object' && 'meta' in error
          ? JSON.stringify(error.meta)
          : undefined;
      this.logger.error(
        `Failed to save contact message: ${message}${code ? ` (code: ${code})` : ''}${meta ? ` meta: ${meta}` : ''}`
      );
      throw new ServiceUnavailableException(
        'We are unable to save your message right now. Please try again in a few minutes.'
      );
    }
  }
}
