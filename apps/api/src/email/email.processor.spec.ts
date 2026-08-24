import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { EmailProcessor } from './email.processor.js';
import type { EmailService } from './email.service.js';

describe('EmailProcessor', () => {
  const emailService = {
    sendTicket: jest.fn()
  } as unknown as jest.Mocked<EmailService>;

  let processor: EmailProcessor;

  beforeEach(() => {
    jest.clearAllMocks();
    emailService.sendTicket.mockResolvedValue(undefined as any);
    processor = new EmailProcessor(emailService as any);
  });

  it('sends a ticket email via the email service', async () => {
    const data = {
      email: 'test@example.com',
      eventTitle: 'Summer Gala',
      cardUrl: 'http://localhost:3000/dashboard/tickets',
      tickets: [{ id: 'ticket-1', qrCodeValue: 'qr-1' }]
    };

    await processor.process(data);

    expect(emailService.sendTicket).toHaveBeenCalledWith(
      data.email,
      data.eventTitle,
      data.cardUrl,
      data.tickets
    );
  });

  it('re-throws email failures so the worker can retry', async () => {
    emailService.sendTicket.mockRejectedValue(new Error('SMTP unavailable'));

    await expect(
      processor.process({
        email: 'test@example.com',
        eventTitle: 'Summer Gala',
        cardUrl: 'http://localhost:3000/dashboard/tickets',
        tickets: []
      })
    ).rejects.toThrow('SMTP unavailable');
  });
});
