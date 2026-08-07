import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import Mail from 'nodemailer/lib/mailer';

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private transporter?: nodemailer.Transporter;
  private from?: string;

  constructor(private readonly configService: ConfigService) {
    const host = configService.get<string>('EMAIL_HOST');
    const user = configService.get<string>('EMAIL_USER');
    const pass = configService.get<string>('EMAIL_PASS');
    const from = configService.get<string>('EMAIL_FROM');

    if (host && user && pass && from) {
      this.from = from;
      this.transporter = nodemailer.createTransport({
        host,
        port: configService.get<number>('EMAIL_PORT') ?? 587,
        secure: (configService.get<number>('EMAIL_PORT') ?? 587) === 465,
        auth: { user, pass }
      });
    } else {
      this.logger.warn(
        'Email is not configured (EMAIL_HOST, EMAIL_USER, EMAIL_PASS, EMAIL_FROM). Emails will be logged but not sent.'
      );
    }
  }

  isEnabled(): boolean {
    return !!this.transporter;
  }

  async send(options: Mail.Options) {
    if (!this.transporter) {
      this.logger.warn(`Email not sent (no SMTP config): ${options.subject ?? '[no subject]'}`);
      return { messageId: 'mock-message-id', accepted: [], rejected: [] };
    }
    return this.transporter.sendMail({
      from: this.from,
      ...options
    });
  }

  async sendTicket(email: string, eventTitle: string, cardUrl?: string) {
    return this.send({
      to: email,
      subject: `Your ticket for ${eventTitle}`,
      html: `<p>Thank you for your purchase. Your ticket is attached.</p>${cardUrl ? `<p><a href="${cardUrl}">View ticket</a></p>` : ''}`
    });
  }

  async sendMembershipCard(email: string, name: string, cardUrl: string) {
    return this.send({
      to: email,
      subject: 'Your Kent SLSC Membership Card',
      html: `<p>Hi ${name}, welcome to Kent SLSC!</p><p><a href="${cardUrl}">Download your membership card</a></p>`
    });
  }

  async sendContactConfirmation(email: string, name: string) {
    return this.send({
      to: email,
      subject: 'We received your message',
      html: `<p>Hi ${name}, thank you for contacting Kent SLSC. We will reply shortly.</p>`
    });
  }
}
