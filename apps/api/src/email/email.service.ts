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
    let from = configService.get<string>('EMAIL_FROM') || user;

    // Hostinger (and several other shared-hosting SMTP servers) requires the
    // envelope From address to be owned by the authenticated user. If the
    // configured From address differs from EMAIL_USER, fall back to EMAIL_USER
    // rather than have every send rejected with "Sender address rejected".
    if (from && user && from.toLowerCase() !== user.toLowerCase()) {
      this.logger.warn(
        `EMAIL_FROM (${from}) does not match EMAIL_USER (${user}). ` +
          'Using EMAIL_USER as the sender address to avoid SMTP rejection.'
      );
      from = user;
    }

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

  /**
   * Wrap a plain HTML email body in a branded Kent SLSC template with a signature.
   * Keeps all outgoing emails visually consistent.
   */
  private wrapHtml(body: string): string {
    const frontendUrl = this.configService.get<string>('FRONTEND_URL') ?? 'https://kentslsc.org';
    const year = new Date().getFullYear();
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Kent Sri Lankan Social Club</title>
</head>
<body style="margin:0;padding:0;background-color:#f1f5f9;font-family:Arial,Helvetica,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#f1f5f9;">
    <tr>
      <td align="center" style="padding:24px 16px;">
        <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;width:100%;background-color:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 4px 6px -1px rgba(0,0,0,0.1);">
          <tr>
            <td style="background-color:#0f172a;padding:24px;text-align:center;">
              <h1 style="margin:0;color:#ffffff;font-size:22px;font-weight:700;">Kent Sri Lankan Social Club</h1>
            </td>
          </tr>
          <tr>
            <td style="padding:32px 24px;color:#334155;font-size:16px;line-height:1.6;">
              ${body}
            </td>
          </tr>
          <tr>
            <td style="background-color:#f8fafc;padding:24px;text-align:center;color:#64748b;font-size:13px;line-height:1.5;border-top:1px solid #e2e8f0;">
              <p style="margin:0 0 8px 0;font-weight:600;color:#0f172a;">Kent Sri Lankan Social Club</p>
              <p style="margin:0 0 8px 0;">Bringing our Sri Lankan community together in Kent.</p>
              <p style="margin:0;"><a href="${frontendUrl}" style="color:#0ea5e9;text-decoration:none;">${frontendUrl}</a></p>
              <p style="margin:16px 0 0 0;font-size:12px;color:#94a3b8;">&copy; ${year} Kent Sri Lankan Social Club. All rights reserved.</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
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
        this.logger.error(`Email not sent (no SMTP config): ${options.subject ?? '[no subject]'}`);
      }
      return { messageId: 'mock-message-id', accepted: [], rejected: [] };
    }
    try {
      const html = typeof options.html === 'string' ? this.wrapHtml(options.html) : options.html;
      return await this.transporter.sendMail({
        from: this.from,
        ...options,
        html
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(
        `Failed to send email to ${String(options.to)} (subject: ${options.subject ?? '[no subject]'}): ${message}`,
        error instanceof Error ? error.stack : undefined
      );
      throw error;
    }
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

  async sendMembershipPaymentLink(email: string, name: string, membershipTypeName: string, paymentUrl: string) {
    return this.send({
      to: email,
      subject: 'Complete your Kent SLSC membership payment',
      html: `<p>Hi ${escapeHtml(name)},</p>
<p>Your membership for <strong>${escapeHtml(membershipTypeName)}</strong> is waiting for payment.</p>
<p><a href="${paymentUrl}">Pay now</a></p>
<p>If you have already paid offline, please ignore this email and contact the club admin.</p>`
    });
  }

  async sendDirectoryPromotionPaymentLink(email: string, businessName: string, paymentUrl: string) {
    return this.send({
      to: email,
      subject: 'Complete your Kent SLSC directory promotion payment',
      html: `<p>Hi ${escapeHtml(email)},</p>
<p>Your directory promotion for <strong>${escapeHtml(businessName)}</strong> is waiting for payment.</p>
<p><a href="${paymentUrl}">Pay now</a></p>
<p>If you have already paid offline, please ignore this email and contact the club admin.</p>`
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
