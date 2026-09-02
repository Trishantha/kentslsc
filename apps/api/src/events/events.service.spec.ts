import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { EventsService } from './events.service.js';
import { TicketStatus, PaymentStatus, PaymentSourceType } from '@kentslsc/database';
import type Stripe from 'stripe';

const originalRandomUUID = crypto.randomUUID;

describe('EventsService', () => {
  let service: EventsService;

  const mockUser = { id: 'user-1', name: 'Test User', email: 'test@example.com' };

  const mockEvent = {
    id: 'event-1',
    title: 'Summer Gala',
    description: 'A fun summer event',
    location: 'Kent',
    startDatetime: new Date(Date.now() + 86400000),
    endDatetime: new Date(Date.now() + 172800000),
    ticketPrice: 10,
    isFree: false,
    maxTickets: 100,
    category: 'SOCIAL' as const,
    imageUrl: null,
    posterImageUrl: null,
    posterImages: null,
    ticketDesign: null,
    isPublished: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
    _count: { tickets: 0 }
  };

  const createdTickets: { id: string; eventId: string; userId: string; qrCodeValue: string; serialNumber: number; ticketNumber: string; status: string; paymentId: string | null; stripeSessionId: string | null; deletedAt: null }[] = [];

  const createMockTicket = (overrides: Partial<typeof createdTickets[0]> = {}) => ({
    id: `ticket-${createdTickets.length + 1}`,
    eventId: mockEvent.id,
    userId: mockUser.id,
    qrCodeValue: `qr-${createdTickets.length + 1}`,
    serialNumber: createdTickets.length + 1,
    ticketNumber: `SUMMER-${String(createdTickets.length + 1).padStart(3, '0')}`,
    status: TicketStatus.VALID,
    paymentId: null,
    stripeSessionId: null,
    deletedAt: null,
    ...overrides
  });

  const mockPrisma: any = {
    event: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
      update: jest.fn()
    },
    ticket: {
      findFirst: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      findUnique: jest.fn()
    },
    payment: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn()
    },
    user: {
      findUnique: jest.fn()
    },
    $transaction: jest.fn(async (cb: any) => {
      const tx = {
        $executeRaw: jest.fn(() => Promise.resolve(undefined)),
        event: mockPrisma.event,
        ticket: {
          count: mockPrisma.ticket.count,
          findFirst: mockPrisma.ticket.findFirst,
          create: mockPrisma.ticket.create
        },
        payment: {
          findUnique: mockPrisma.payment.findUnique,
          create: mockPrisma.payment.create,
          update: mockPrisma.payment.update
        }
      };
      return cb(tx);
    })
  };

  const mockPaymentsService: any = {
    createCheckout: jest.fn(),
    getOrCreateStripeCustomer: (jest.fn() as jest.Mock<() => Promise<string>>).mockResolvedValue('cus_test_user_1'),
    getCheckoutSession: jest.fn()
  };

  const mockEmailQueueService: any = {
    addSendTicketEmailJob: (jest.fn() as jest.Mock<(...args: any[]) => Promise<any>>).mockResolvedValue(undefined)
  };

  const mockConfigService: any = {
    get: jest.fn((key: string) => {
      if (key === 'FRONTEND_URL') return 'http://localhost:3000';
      return undefined;
    })
  };

  beforeEach(() => {
    createdTickets.length = 0;
    jest.clearAllMocks();
    crypto.randomUUID = jest.fn(() => `mock-qr-${createdTickets.length + 1}`) as any;

    service = new EventsService(
      mockPrisma as any,
      mockPaymentsService as any,
      mockEmailQueueService as any,
      mockConfigService as any
    );
  });

  afterEach(() => {
    crypto.randomUUID = originalRandomUUID;
  });

  describe('createCheckoutSession', () => {
    it('creates tickets immediately for a free event', async () => {
      mockPrisma.event.findUnique.mockResolvedValue({ ...mockEvent, isFree: true, ticketPrice: 0, _count: { tickets: 0 } });
      mockPrisma.user.findUnique.mockResolvedValue(mockUser);
      mockPrisma.ticket.findFirst.mockResolvedValue(null);
      mockPrisma.ticket.count.mockResolvedValue(0);
      mockPrisma.payment.create.mockResolvedValue({ id: 'payment-free' });
      mockPrisma.ticket.create
        .mockResolvedValueOnce(createMockTicket({ id: 'free-1', paymentId: 'payment-free' }))
        .mockResolvedValueOnce(createMockTicket({ id: 'free-2', paymentId: 'payment-free' }));

      const result = await service.createCheckoutSession(mockUser.id, {
        eventId: mockEvent.id,
        quantity: 2
      });

      expect(result.free).toBe(true);
      expect(result.tickets).toHaveLength(2);
      expect(mockPaymentsService.createCheckout).not.toHaveBeenCalled();
      expect(mockEmailQueueService.addSendTicketEmailJob).toHaveBeenCalled();
      expect(mockPrisma.payment.create).toHaveBeenCalled();
    });

    it('creates a Stripe checkout for paid tickets', async () => {
      mockPrisma.event.findUnique.mockResolvedValue(mockEvent);
      mockPrisma.ticket.count.mockResolvedValue(0);
      mockPaymentsService.createCheckout.mockResolvedValue({
        id: 'cs_test_123',
        url: 'https://checkout.stripe.com/test',
        provider: 'stripe'
      });

      const result = await service.createCheckoutSession(mockUser.id, {
        eventId: mockEvent.id,
        quantity: 2
      });

      expect(result.free).toBe(false);
      expect(result.sessionId).toBe('cs_test_123');
      expect(mockPaymentsService.createCheckout).toHaveBeenCalledWith(
        expect.objectContaining({
          amount: 2000,
          currency: 'gbp',
          customer: 'cus_test_user_1',
          metadata: expect.objectContaining({ type: 'event_ticket', quantity: '2' })
        })
      );
      expect(mockPaymentsService.getOrCreateStripeCustomer).toHaveBeenCalledWith(mockUser.id, mockUser.email);
    });
  });

  describe('handleCheckoutCompleted', () => {
    it('creates tickets for a completed Stripe session', async () => {
      const session = {
        id: 'cs_test_123',
        metadata: {
          type: 'event_ticket',
          eventId: mockEvent.id,
          userId: mockUser.id,
          quantity: '3'
        }
      } as unknown as Stripe.Checkout.Session;

      mockPrisma.event.findUnique.mockResolvedValue(mockEvent);
      mockPrisma.user.findUnique.mockResolvedValue(mockUser);
      mockPrisma.ticket.findMany.mockResolvedValueOnce([]);
      mockPrisma.ticket.findFirst.mockResolvedValue(null);
      mockPrisma.ticket.count.mockResolvedValue(0);
      mockPrisma.payment.create.mockResolvedValue({ id: 'payment-1' });
      mockPrisma.payment.update.mockResolvedValue({ id: 'payment-1' });
      mockPrisma.ticket.create
        .mockResolvedValueOnce(createMockTicket({ id: 'paid-1', stripeSessionId: session.id }))
        .mockResolvedValueOnce(createMockTicket({ id: 'paid-2', stripeSessionId: session.id }))
        .mockResolvedValueOnce(createMockTicket({ id: 'paid-3', stripeSessionId: session.id }));

      const result = await service.handleCheckoutCompleted(session);

      expect(result).toHaveLength(3);
      expect(mockPrisma.ticket.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ stripeSessionId: session.id, deletedAt: null })
        })
      );
      expect(mockPrisma.payment.create).toHaveBeenCalled();
    });

    it('returns existing tickets and does not create duplicates when Stripe retries the webhook', async () => {
      const session = {
        id: 'cs_test_123',
        metadata: {
          type: 'event_ticket',
          eventId: mockEvent.id,
          userId: mockUser.id,
          quantity: '2'
        }
      } as unknown as Stripe.Checkout.Session;

      const existing = [
        createMockTicket({ id: 'paid-1', stripeSessionId: session.id }),
        createMockTicket({ id: 'paid-2', stripeSessionId: session.id })
      ];

      mockPrisma.ticket.findMany.mockResolvedValueOnce(existing);

      const result = await service.handleCheckoutCompleted(session);

      expect(result).toEqual(existing);
      expect(mockPrisma.ticket.create).not.toHaveBeenCalled();
      expect(mockEmailQueueService.addSendTicketEmailJob).not.toHaveBeenCalled();
    });

    it('returns null when metadata is missing', async () => {
      const session = { id: 'cs_test_123', metadata: {} } as unknown as Stripe.Checkout.Session;
      const result = await service.handleCheckoutCompleted(session);
      expect(result).toBeNull();
    });

    it('does not issue tickets until Stripe reports the payment as paid', async () => {
      const session = {
        id: 'cs_test_unpaid',
        payment_status: 'unpaid',
        metadata: {
          type: 'event_ticket',
          eventId: mockEvent.id,
          userId: mockUser.id,
          quantity: '1'
        }
      } as unknown as Stripe.Checkout.Session;

      await expect(service.handleCheckoutCompleted(session)).rejects.toThrow(
        'Checkout session payment is not complete'
      );
      expect(mockPrisma.ticket.create).not.toHaveBeenCalled();
    });
  });

  describe('generateTickets', () => {
    it('issues tickets to the selected user and queues their email', async () => {
      const adminUserId = 'admin-1';
      const recipient = { ...mockUser, id: 'recipient-1', email: 'recipient@example.com' };
      mockPrisma.event.findUnique.mockResolvedValue(mockEvent);
      mockPrisma.user.findUnique.mockResolvedValue(recipient);
      mockPrisma.ticket.findFirst.mockResolvedValue(null);
      mockPrisma.ticket.count.mockResolvedValue(0);
      mockPrisma.payment.create.mockResolvedValue({ id: 'payment-1' });
      mockPrisma.payment.update.mockResolvedValue({ id: 'payment-1' });
      mockPrisma.ticket.create.mockResolvedValue(
        createMockTicket({ id: 'generated-1', userId: recipient.id })
      );

      const result = await service.generateTickets(adminUserId, mockEvent.id, {
        quantity: 1,
        userId: recipient.id,
        notes: 'Telephone booking'
      });

      expect(result.totalGenerated).toBe(1);
      expect(mockPrisma.user.findUnique).toHaveBeenCalledWith({ where: { id: recipient.id } });
      expect(mockPrisma.payment.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            userId: recipient.id,
            notes: `Support-issued by ${adminUserId}: Telephone booking`
          })
        })
      );
      expect(mockPrisma.ticket.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ userId: recipient.id }) })
      );
      expect(mockEmailQueueService.addSendTicketEmailJob).toHaveBeenCalledWith(
        expect.objectContaining({ email: recipient.email })
      );
    });

    it('attaches tickets to an existing completed card payment', async () => {
      const adminUserId = 'admin-1';
      const payment = {
        id: 'payment-1',
        userId: mockUser.id,
        eventId: mockEvent.id,
        paymentChannel: 'stripe',
        paymentMethod: 'card',
        paymentStatus: PaymentStatus.COMPLETED,
        sourceType: PaymentSourceType.TICKET,
        currency: 'GBP',
        grossAmount: 20,
        processingFee: 0.5,
        netAmount: 19.5
      };
      mockPrisma.event.findUnique.mockResolvedValue(mockEvent);
      mockPrisma.user.findUnique.mockResolvedValue(mockUser);
      mockPrisma.payment.findUnique.mockResolvedValue(payment);
      mockPrisma.ticket.findFirst.mockResolvedValue(null);
      mockPrisma.ticket.count.mockResolvedValue(0);
      mockPrisma.payment.update.mockResolvedValue(payment);
      mockPrisma.ticket.create.mockResolvedValue(
        createMockTicket({ id: 'recovered-1', paymentId: payment.id })
      );

      const result = await service.generateTickets(adminUserId, mockEvent.id, {
        quantity: 1,
        paymentId: payment.id
      });

      expect(result.totalGenerated).toBe(1);
      expect(mockPrisma.payment.create).not.toHaveBeenCalled();
      expect(mockPrisma.ticket.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ paymentId: payment.id }) })
      );
      expect(mockPrisma.payment.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: payment.id },
          data: expect.objectContaining({
            userId: mockUser.id,
            eventId: mockEvent.id,
            sourceType: PaymentSourceType.TICKET
          })
        })
      );
    });

    it('rejects a card payment that is already attached to a ticket', async () => {
      const payment = {
        id: 'payment-1',
        userId: mockUser.id,
        eventId: mockEvent.id,
        paymentChannel: 'stripe',
        paymentMethod: 'card',
        paymentStatus: PaymentStatus.COMPLETED,
        sourceType: PaymentSourceType.TICKET,
        currency: 'GBP',
        grossAmount: 10,
        processingFee: 0.3,
        netAmount: 9.7
      };
      mockPrisma.event.findUnique.mockResolvedValue(mockEvent);
      mockPrisma.user.findUnique.mockResolvedValue(mockUser);
      mockPrisma.payment.findUnique.mockResolvedValue(payment);
      mockPrisma.ticket.findFirst.mockResolvedValue(null);
      mockPrisma.ticket.count.mockResolvedValueOnce(0).mockResolvedValueOnce(1);

      await expect(
        service.generateTickets('admin-1', mockEvent.id, {
          quantity: 1,
          paymentId: payment.id
        })
      ).rejects.toThrow('Tickets already issued for this payment');

      expect(mockPrisma.ticket.create).not.toHaveBeenCalled();
    });
  });

  describe('findAttachablePayments', () => {
    it('excludes payments linked to active tickets', async () => {
      const payment = {
        id: 'payment-available',
        receiptNumber: 'RCP-001',
        purchasedAt: new Date('2026-09-01T12:00:00.000Z'),
        createdAt: new Date('2026-09-01T11:00:00.000Z'),
        description: 'Ticket payment',
        currency: 'GBP',
        grossAmount: 20,
        paymentStatus: PaymentStatus.COMPLETED,
        sourceType: PaymentSourceType.TICKET,
        event: { id: mockEvent.id, title: mockEvent.title },
        user: mockUser
      };
      mockPrisma.event.findUnique.mockResolvedValue(mockEvent);
      mockPrisma.ticket.findMany.mockResolvedValue([
        { paymentId: 'payment-attached' },
        { paymentId: null }
      ]);
      mockPrisma.payment.findMany.mockResolvedValue([payment]);

      const result = await service.findAttachablePayments(mockEvent.id, mockUser.id);

      expect(mockPrisma.ticket.findMany).toHaveBeenCalledWith({
        where: { paymentId: { not: null }, deletedAt: null },
        select: { paymentId: true }
      });
      expect(mockPrisma.payment.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ id: { notIn: ['payment-attached'] } })
        })
      );
      expect(result).toEqual([
        expect.objectContaining({
          id: payment.id,
          date: payment.purchasedAt.toISOString(),
          event: payment.event,
          user: payment.user
        })
      ]);
    });
  });

  describe('confirmCheckoutSession', () => {
    it('issues tickets when the authenticated user confirms a completed Stripe session', async () => {
      const sessionId = 'cs_test_123';

      mockPaymentsService.getCheckoutSession.mockResolvedValue({
        id: sessionId,
        status: 'complete',
        paymentStatus: 'paid',
        amountTotal: 2000,
        currency: 'gbp',
        metadata: {
          type: 'event_ticket',
          eventId: mockEvent.id,
          userId: mockUser.id,
          quantity: '2'
        },
        customerEmail: mockUser.email,
        paymentIntentId: 'pi_test_123'
      });

      mockPrisma.event.findUnique.mockResolvedValue(mockEvent);
      mockPrisma.user.findUnique.mockResolvedValue(mockUser);
      mockPrisma.ticket.findMany.mockResolvedValue([]);
      mockPrisma.ticket.findFirst.mockResolvedValue(null);
      mockPrisma.ticket.count.mockResolvedValue(0);
      mockPrisma.payment.create.mockResolvedValue({ id: 'payment-1' });
      mockPrisma.payment.update.mockResolvedValue({ id: 'payment-1' });
      mockPrisma.ticket.create
        .mockResolvedValueOnce(createMockTicket({ id: 'confirmed-1', stripeSessionId: sessionId }))
        .mockResolvedValueOnce(createMockTicket({ id: 'confirmed-2', stripeSessionId: sessionId }));

      const result = await service.confirmCheckoutSession(sessionId, 'stripe', mockUser.id);

      expect(mockPaymentsService.getCheckoutSession).toHaveBeenCalledWith(sessionId, mockUser.id);
      expect(result.created).toBe(true);
      expect(result.tickets).toHaveLength(2);
      expect(mockEmailQueueService.addSendTicketEmailJob).toHaveBeenCalled();
    });

    it('returns existing tickets without creating duplicates', async () => {
      const sessionId = 'cs_test_123';
      const existing = [
        createMockTicket({ id: 'paid-1', stripeSessionId: sessionId }),
        createMockTicket({ id: 'paid-2', stripeSessionId: sessionId })
      ];

      mockPrisma.ticket.findMany.mockResolvedValueOnce(existing);

      const result = await service.confirmCheckoutSession(sessionId, 'stripe', mockUser.id);

      expect(mockPaymentsService.getCheckoutSession).not.toHaveBeenCalled();
      expect(result.created).toBe(false);
      expect(result.tickets).toEqual(existing);
    });

    it('throws when the Stripe session is not complete', async () => {
      const sessionId = 'cs_test_open';
      mockPaymentsService.getCheckoutSession.mockResolvedValue({
        id: sessionId,
        status: 'open',
        paymentStatus: 'unpaid',
        amountTotal: 2000,
        currency: 'gbp',
        metadata: null,
        customerEmail: null,
        paymentIntentId: null
      });

      await expect(service.confirmCheckoutSession(sessionId, 'stripe', mockUser.id)).rejects.toThrow(
        'Checkout session is not complete'
      );
    });

    it('throws when the Stripe session is complete but payment is not paid', async () => {
      const sessionId = 'cs_test_unpaid';
      mockPaymentsService.getCheckoutSession.mockResolvedValue({
        id: sessionId,
        status: 'complete',
        paymentStatus: 'unpaid',
        amountTotal: 2000,
        currency: 'gbp',
        metadata: null,
        customerEmail: null,
        paymentIntentId: null
      });

      await expect(service.confirmCheckoutSession(sessionId, 'stripe', mockUser.id)).rejects.toThrow(
        'Checkout session is not complete'
      );
      expect(mockPrisma.ticket.create).not.toHaveBeenCalled();
    });
  });

  describe('createTickets', () => {
    it('allows multiple tickets to reference the same Stripe session in the Prisma schema', () => {
      const schemaPath = [
        resolve(process.cwd(), '../../packages/database/prisma/schema.prisma'),
        resolve(process.cwd(), 'packages/database/prisma/schema.prisma')
      ].find((path) => existsSync(path));
      expect(schemaPath).toBeDefined();

      const schema = readFileSync(schemaPath!, 'utf8');
      const ticketModel = schema.match(/model Ticket \{[\s\S]*?\n\}/)?.[0] ?? '';

      expect(ticketModel).toContain('stripeSessionId String?     @map("stripe_session_id")');
      expect(ticketModel).toContain('@@index([stripeSessionId])');
      expect(ticketModel).not.toContain('stripeSessionId String?     @unique');
    });

    it('throws if tickets already exist for the same Stripe session', async () => {
      mockPrisma.event.findUnique.mockResolvedValue(mockEvent);
      mockPrisma.user.findUnique.mockResolvedValue(mockUser);
      mockPrisma.ticket.findFirst.mockResolvedValue(null);
      mockPrisma.ticket.count.mockResolvedValueOnce(0).mockResolvedValueOnce(1);
      mockPrisma.payment.create.mockResolvedValue({ id: 'payment-1' });

      await expect(
        service.createTickets(mockUser.id, mockEvent.id, 1, 'http://localhost:3000', {
          channel: 'stripe',
          grossAmount: 1000,
          processingFee: 0,
          netAmount: 1000,
          providerCheckoutId: 'cs_test_123',
          paymentStatus: PaymentStatus.COMPLETED,
          sourceType: PaymentSourceType.TICKET
        })
      ).rejects.toThrow('Tickets already issued for this payment session');
    });
  });

  describe('listEventTickets', () => {
    it('returns tickets wrapped in an object', async () => {
      const tickets = [
        createMockTicket({ id: 't1', serialNumber: 1 }),
        createMockTicket({ id: 't2', serialNumber: 2 })
      ];
      mockPrisma.event.findUnique.mockResolvedValue(mockEvent);
      mockPrisma.ticket.findMany.mockResolvedValue(tickets);

      const result = await service.listEventTickets(mockEvent.id);

      expect(result).toEqual({ tickets });
      expect(mockPrisma.ticket.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { eventId: mockEvent.id, deletedAt: null },
          orderBy: { serialNumber: 'asc' }
        })
      );
    });
  });

  describe('resendTicketEmail', () => {
    it('sends the ticket email to the user', async () => {
      const ticket = createMockTicket({ id: 'ticket-1' });
      mockPrisma.ticket.findFirst.mockResolvedValue({
        ...ticket,
        event: mockEvent,
        user: { id: mockUser.id, name: mockUser.name, email: mockUser.email }
      });

      const result = await service.resendTicketEmail(ticket.id, mockUser.id, mockUser.email);

      expect(result).toEqual({ sent: true });
      expect(mockEmailQueueService.addSendTicketEmailJob).toHaveBeenCalledWith(
        expect.objectContaining({
          email: mockUser.email,
          eventTitle: mockEvent.title,
          cardUrl: 'http://localhost:3000/dashboard/tickets',
          tickets: [{ id: ticket.id, qrCodeValue: ticket.qrCodeValue }]
        })
      );
    });

    it('throws when the ticket does not belong to the user', async () => {
      mockPrisma.ticket.findFirst.mockResolvedValue(null);

      await expect(
        service.resendTicketEmail('missing-id', mockUser.id, mockUser.email)
      ).rejects.toThrow('Ticket not found');
    });
  });

  describe('findAttachablePayments', () => {
    it('returns only eligible completed stripe payments with no linked tickets', async () => {
      mockPrisma.event.findUnique.mockResolvedValue(mockEvent);
      mockPrisma.payment.findMany.mockResolvedValue([
        {
          id: 'pay-1',
          receiptNumber: 'KS-0001',
          createdAt: new Date('2026-09-01T10:00:00Z'),
          purchasedAt: new Date('2026-09-01T10:00:00Z'),
          description: 'Ticket purchase',
          currency: 'GBP',
          grossAmount: 20,
          paymentStatus: PaymentStatus.COMPLETED,
          sourceType: PaymentSourceType.TICKET,
          event: { id: mockEvent.id, title: mockEvent.title },
          user: { id: mockUser.id, name: mockUser.name, email: mockUser.email }
        }
      ]);

      const result = await service.findAttachablePayments(mockEvent.id, mockUser.id);

      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        id: 'pay-1',
        receiptNumber: 'KS-0001',
        description: 'Ticket purchase',
        grossAmount: 20
      });
      expect(mockPrisma.payment.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            paymentStatus: PaymentStatus.COMPLETED,
            paymentChannel: 'stripe',
            paymentMethod: 'card',
            sourceType: { in: [PaymentSourceType.TICKET, PaymentSourceType.MANUAL] }
          })
        })
      );
    });
  });
});
