import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import Mail from 'nodemailer/lib/mailer';
import QRCode from 'qrcode';

/** Names are user-supplied and land in an HTML body. */
function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private transporter?: nodemailer.Transporter;
  private from?: string;

  constructor(private readonly configService: ConfigService) {
    const host = configService.get<string>('EMAIL_HOST');
    const user = configService.get<string>('EMAIL_USER');
    const pass = configService.get<string>('EMAIL_PASS');
    const from = configService.get<string>('EMAIL_FROM') || user;

    if (host && user && pass && from) {
      this.from = from;
      this.transporter = nodemailer.createTransport({
        host,
        port: configService.get<number>('EMAIL_PORT') ?? 587,
        secure: (configService.get<number>('EMAIL_PORT') ?? 587) === 465,
        auth: { user, pass }
      });
    } else {
      const missing = ['EMAIL_HOST', 'EMAIL_USER', 'EMAIL_PASS', 'EMAIL_FROM'].filter(
        (key) => !configService.get<string>(key)
      );
      const message = `Email is not configured (${missing.join(', ')}). Emails will be logged but not sent.`;
      if (process.env.NODE_ENV === 'production') {
        this.logger.error(
          `${message} In production this means verification and password-reset emails are silently dropped.`
        );
      } else {
        this.logger.warn(message);
      }
    }
  }

  isEnabled(): boolean {
    return !!this.transporter;
  }

  async send(options: Mail.Options) {
    if (!this.transporter) {
      // Outside production, print the body so a developer can copy the
      // verification or reset link out of the console. Without this the whole
      // email-verification flow is untestable on a machine with no SMTP.
      if (process.env.NODE_ENV !== 'production') {
        this.logger.log(
          `[email not sent - no SMTP config]\n  to: ${String(options.to)}\n  subject: ${options.subject ?? '[no subject]'}\n  body: ${String(options.html ?? options.text ?? '')}`
        );
      } else {
        this.logger.warn(`Email not sent (no SMTP config): ${options.subject ?? '[no subject]'}`);
      }
      return { messageId: 'mock-message-id', accepted: [], rejected: [] };
    }
    return this.transporter.sendMail({
      from: this.from,
      ...options
    });
  }

  async sendEmailVerification(email: string, name: string, verifyUrl: string, expiresInHours: number) {
    return this.send({
      to: email,
      subject: 'Confirm your Kent SLSC email address',
      html: `<p>Hi ${escapeHtml(name)},</p>
<p>Please confirm your email address to finish setting up your Kent SLSC account.</p>
<p><a href="${verifyUrl}">Confirm my email address</a></p>
<p>This link expires in ${expiresInHours} hours. If you did not create an account, you can ignore this email.</p>`
    });
  }

  async sendPasswordReset(email: string, name: string, resetUrl: string, expiresInMinutes: number) {
    return this.send({
      to: email,
      subject: 'Reset your Kent SLSC password',
      html: `<p>Hi ${escapeHtml(name)},</p>
<p>We received a request to reset your password.</p>
<p><a href="${resetUrl}">Choose a new password</a></p>
<p>This link expires in ${expiresInMinutes} minutes and can only be used once. If you did not request this, no action is needed — your password has not changed.</p>`
    });
  }

  async sendPasswordChanged(email: string, name: string) {
    return this.send({
      to: email,
      subject: 'Your Kent SLSC password was changed',
      html: `<p>Hi ${escapeHtml(name)},</p>
<p>Your password was just changed and you have been signed out on all devices.</p>
<p>If this wasn't you, reset your password immediately and contact us.</p>`
    });
  }

  async sendAccountLocked(email: string, name: string, lockedForSeconds: number) {
    const minutes = Math.round(lockedForSeconds / 60);
    return this.send({
      to: email,
      subject: 'Unusual sign-in activity on your Kent SLSC account',
      html: `<p>Hi ${escapeHtml(name)},</p>
<p>We blocked repeated failed sign-in attempts on your account. Sign-in is paused for ${minutes} minutes.</p>
<p>If this was you, simply wait and try again. If it wasn't, we recommend resetting your password.</p>`
    });
  }

  async sendAdminCreatedAccount(email: string, name: string, setPasswordUrl: string) {
    return this.send({
      to: email,
      subject: 'Your Kent SLSC account has been created',
      html: `<p>Hi ${escapeHtml(name)},</p>
<p>An administrator has created an account for you at Kent SLSC.</p>
<p><a href="${setPasswordUrl}">Set your password</a></p>
<p>This link expires in 7 days.</p>`
    });
  }

  async sendTicket(
    email: string,
    eventTitle: string,
    cardUrl: string,
    tickets: { id: string; qrCodeValue: string }[] = []
  ) {
    const attachments: Mail.Attachment[] = [];
    const ticketItems: string[] = [];

    for (const [index, ticket] of tickets.entries()) {
      const dataUrl = await QRCode.toDataURL(ticket.qrCodeValue, { width: 256, margin: 2 });
      const base64 = dataUrl.replace(/^data:image\/png;base64,/, '');
      const cid = `ticket-qr-${ticket.id}`;
      attachments.push({
        filename: `ticket-${index + 1}.png`,
        content: Buffer.from(base64, 'base64'),
        cid
      });
      ticketItems.push(
        `<div style="margin-bottom: 24px; border: 1px solid #e2e8f0; border-radius: 12px; padding: 16px; text-align: center;">
          <p style="margin: 0 0 8px; font-size: 14px; color: #64748b;">Ticket ${index + 1} of ${tickets.length}</p>
          <img src="cid:${cid}" alt="Ticket QR code" style="width: 160px; height: 160px;" />
          <p style="margin: 8px 0 0; font-family: monospace; font-size: 12px; color: #94a3b8;">${ticket.qrCodeValue}</p>
        </div>`
      );
    }

    return this.send({
      to: email,
      subject: tickets.length > 1 ? `Your tickets for ${eventTitle}` : `Your ticket for ${eventTitle}`,
      attachments,
      html: `
        <p>Thank you for your purchase for <strong>${escapeHtml(eventTitle)}</strong>.</p>
        ${ticketItems.length ? ticketItems.join('') : '<p>Your tickets are available in your dashboard.</p>'}
        <p><a href="${cardUrl}">View your tickets in the dashboard</a></p>
        <p style="font-size: 12px; color: #64748b;">Show the QR code at the entrance. Each code can only be used once.</p>
      `
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
      html: `<p>Hi ${escapeHtml(name)}, thank you for contacting Kent SLSC. We will reply shortly.</p>`
    });
  }

  async sendContactNotification(
    adminEmail: string,
    message: { name: string; email: string; phone: string | null; subject: string; message: string }
  ) {
    return this.send({
      to: adminEmail,
      subject: `New contact message: ${escapeHtml(message.subject)}`,
      html: `<p>You have received a new message via the Kent SLSC contact form.</p>
<p><strong>From:</strong> ${escapeHtml(message.name)} &lt;${escapeHtml(message.email)}&gt;</p>
${message.phone ? `<p><strong>Phone:</strong> ${escapeHtml(message.phone)}</p>` : ''}
<p><strong>Subject:</strong> ${escapeHtml(message.subject)}</p>
<p><strong>Message:</strong></p>
<p>${escapeHtml(message.message).replace(/\n/g, '<br/>')}</p>
<p>Reply directly to this email to respond to ${escapeHtml(message.name)}.</p>`
    });
  }

  async sendDonationThankYou(email: string, name: string, campaignTitle: string, amount: number) {
    return this.send({
      to: email,
      subject: `Thank you for your donation to ${campaignTitle}`,
      html: `<p>Hi ${escapeHtml(name)},</p>
<p>Thank you so much for your generous donation of <strong>£${amount.toFixed(2)}</strong> to <strong>${escapeHtml(campaignTitle)}</strong>.</p>
<p>Your support makes a real difference to our community at Kent Sri Lankan Social Club.</p>
<p>With gratitude,<br/>The Kent SLSC Team</p>`
    });
  }

  async sendMilestoneReached(
    email: string,
    name: string,
    campaignTitle: string,
    milestone: number,
    raisedAmount: number
  ) {
    return this.send({
      to: email,
      subject: `Your campaign just hit ${milestone}% of its goal! 🎉`,
      html: `<p>Hi ${escapeHtml(name)},</p>
<p>Amazing news! Your campaign <strong>${escapeHtml(campaignTitle)}</strong> has just reached <strong>${milestone}%</strong> of its fundraising goal, with <strong>£${raisedAmount.toFixed(2)}</strong> raised so far.</p>
<p>Keep sharing your campaign to hit that 100% target!</p>
<p>The Kent SLSC Team</p>`
    });
  }
}
