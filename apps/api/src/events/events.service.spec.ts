import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { EventsService } from './events.service.js';
import { TicketStatus } from '@kentslsc/database';
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
    user: {
      findUnique: jest.fn()
    },
    $transaction: jest.fn(async (cb: any) => {
      const tx = {
        ticket: {
          count: mockPrisma.ticket.count,
          create: mockPrisma.ticket.create
        }
      };
      return cb(tx);
    })
  };

  const mockPaymentsService: any = {
    createCheckout: jest.fn(),
    getOrCreateStripeCustomer: jest.fn().mockResolvedValue('cus_test_user_1')
  };

  const mockEmailService: any = {
    sendTicket: (jest.fn() as jest.Mock<(...args: any[]) => Promise<any>>).mockResolvedValue(undefined)
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
      mockEmailService as any,
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
      mockPrisma.ticket.create
        .mockResolvedValueOnce(createMockTicket({ id: 'free-1' }))
        .mockResolvedValueOnce(createMockTicket({ id: 'free-2' }));

      const result = await service.createCheckoutSession(mockUser.id, {
        eventId: mockEvent.id,
        quantity: 2
      });

      expect(result.free).toBe(true);
      expect(result.tickets).toHaveLength(2);
      expect(mockPaymentsService.createCheckout).not.toHaveBeenCalled();
      expect(mockEmailService.sendTicket).toHaveBeenCalled();
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
      expect(mockEmailService.sendTicket).not.toHaveBeenCalled();
    });

    it('returns null when metadata is missing', async () => {
      const session = { id: 'cs_test_123', metadata: {} } as unknown as Stripe.Checkout.Session;
      const result = await service.handleCheckoutCompleted(session);
      expect(result).toBeNull();
    });
  });

  describe('createTickets', () => {
    it('throws if tickets already exist for the same Stripe session', async () => {
      mockPrisma.event.findUnique.mockResolvedValue(mockEvent);
      mockPrisma.user.findUnique.mockResolvedValue(mockUser);
      mockPrisma.ticket.count.mockResolvedValueOnce(0).mockResolvedValueOnce(1);

      await expect(
        service.createTickets(mockUser.id, mockEvent.id, 1, 'cs_test_123', 'http://localhost:3000')
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
});
