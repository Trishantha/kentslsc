import { Injectable, NotFoundException, BadRequestException, ForbiddenException, Inject } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../core/prisma/prisma.service.js';
import type { PaymentsService } from '../payments/payments.service.js';
import { EmailService } from '../email/email.service.js';
import type Stripe from 'stripe';
import QRCode from 'qrcode';
import type { CreateEventDto, UpdateEventDto, PurchaseTicketsDto } from './dto/index.js';
import type { EnvConfig } from '../core/config/env.validation.js';
import { TicketStatus } from '@kentslsc/database';

export interface TicketWithEvent {
  id: string;
  qrCodeValue: string;
  status: string;
  purchaseDatetime: Date;
  event: {
    id: string;
    title: string;
    startDatetime: Date;
    endDatetime: Date;
    location: string | null;
  };
}

@Injectable()
export class EventsService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject('PAYMENTS_SERVICE')
    private readonly paymentsService: PaymentsService,
    private readonly emailService: EmailService,
    private readonly configService: ConfigService<EnvConfig, true>
  ) {}

  async listPublished(page = 1, limit = 20, filters?: { search?: string; upcoming?: boolean }) {
    const where: { isPublished: boolean; deletedAt: null; OR?: Record<string, unknown>[]; startDatetime?: { gte: Date } } = {
      isPublished: true,
      deletedAt: null
    };

    if (filters?.search) {
      const term = filters.search;
      where.OR = [
        { title: { contains: term, mode: 'insensitive' } },
        { description: { contains: term, mode: 'insensitive' } },
        { location: { contains: term, mode: 'insensitive' } }
      ];
    }

    if (filters?.upcoming) {
      where.startDatetime = { gte: new Date() };
    }

    const [data, total] = await Promise.all([
      this.prisma.event.findMany({
        where,
        orderBy: { startDatetime: 'asc' },
        take: limit,
        skip: (page - 1) * limit
      }),
      this.prisma.event.count({ where })
    ]);

    return { data, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  async listAll(page = 1, limit = 20) {
    const [data, total] = await Promise.all([
      this.prisma.event.findMany({
        where: { deletedAt: null },
        orderBy: { startDatetime: 'asc' },
        take: limit,
        skip: (page - 1) * limit,
        include: { _count: { select: { tickets: true } } }
      }),
      this.prisma.event.count({ where: { deletedAt: null } })
    ]);

    return { data, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  async findById(id: string) {
    const event = await this.prisma.event.findUnique({ where: { id, deletedAt: null } });
    if (!event) throw new NotFoundException('Event not found');
    return event;
  }

  async findByIdWithTicketCount(id: string) {
    const event = await this.prisma.event.findUnique({
      where: { id, deletedAt: null },
      include: {
        tickets: {
          where: { status: { not: TicketStatus.CANCELLED }, deletedAt: null },
          select: { id: true }
        }
      }
    });
    if (!event) throw new NotFoundException('Event not found');
    return event;
  }

  async create(dto: CreateEventDto) {
    return this.prisma.event.create({
      data: {
        title: dto.title,
        description: dto.description,
        location: dto.location,
        startDatetime: new Date(dto.startDatetime),
        endDatetime: new Date(dto.endDatetime),
        ticketPrice: dto.isFree ? 0 : dto.ticketPrice,
        isFree: dto.isFree ?? false,
        maxTickets: dto.maxTickets,
        imageUrl: dto.imageUrl,
        isPublished: dto.isPublished ?? false
      }
    });
  }

  async update(id: string, dto: UpdateEventDto) {
    await this.findById(id);
    return this.prisma.event.update({
      where: { id },
      data: {
        ...(dto.title !== undefined && { title: dto.title }),
        ...(dto.description !== undefined && { description: dto.description }),
        ...(dto.location !== undefined && { location: dto.location }),
        ...(dto.startDatetime !== undefined && { startDatetime: new Date(dto.startDatetime) }),
        ...(dto.endDatetime !== undefined && { endDatetime: new Date(dto.endDatetime) }),
        ...(dto.isFree !== undefined && { isFree: dto.isFree }),
        ...(dto.ticketPrice !== undefined && { ticketPrice: dto.isFree ? 0 : dto.ticketPrice }),
        ...(dto.maxTickets !== undefined && { maxTickets: dto.maxTickets }),
        ...(dto.imageUrl !== undefined && { imageUrl: dto.imageUrl }),
        ...(dto.isPublished !== undefined && { isPublished: dto.isPublished })
      }
    });
  }

  async remove(id: string) {
    await this.findById(id);
    return this.prisma.event.update({ where: { id }, data: { deletedAt: new Date() } });
  }

  async getRemainingCapacity(eventId: string) {
    const event = await this.findByIdWithTicketCount(eventId);
    if (!event.maxTickets) return null;
    return event.maxTickets - event.tickets.length;
  }

  async createCheckoutSession(userId: string, dto: PurchaseTicketsDto) {
    const event = await this.findById(dto.eventId);
    if (!event.isPublished) throw new ForbiddenException('Event is not published');
    if (event.startDatetime < new Date()) throw new BadRequestException('Event has already started');

    const remaining = await this.getRemainingCapacity(dto.eventId);
    if (remaining !== null && dto.quantity > remaining) {
      throw new BadRequestException(`Only ${remaining} tickets remaining`);
    }

    const isFree = event.isFree || Number(event.ticketPrice) === 0;
    const unitAmount = Math.round(Number(event.ticketPrice) * 100);
    const totalAmount = unitAmount * dto.quantity;
    const origin = this.configService.get('FRONTEND_URL', { infer: true });

    if (isFree || totalAmount === 0) {
      // Free event: create tickets immediately without Stripe
      const tickets = await this.createTickets(userId, dto.eventId, dto.quantity, 'free', origin);
      return { free: true, tickets };
    }

    const session = await this.paymentsService.createCheckoutSession({
      mode: 'payment',
      line_items: [
        {
          price_data: {
            currency: 'gbp',
            product_data: { name: event.title },
            unit_amount: unitAmount
          },
          quantity: dto.quantity
        }
      ],
      metadata: {
        eventId: dto.eventId,
        userId,
        quantity: String(dto.quantity),
        type: 'event_ticket'
      },
      success_url: `${origin}/dashboard/tickets?success=1`,
      cancel_url: `${origin}/events/${dto.eventId}?canceled=1`
    });

    return { free: false, sessionId: session.id, url: session.url };
  }

  async handleCheckoutCompleted(session: Stripe.Checkout.Session) {
    if (session.metadata?.type !== 'event_ticket') return null;
    const eventId = session.metadata.eventId;
    const userId = session.metadata.userId;
    const quantity = Number(session.metadata.quantity || '1');

    if (!eventId || !userId) return null;

    const origin = this.configService.get('FRONTEND_URL', { infer: true });
    const tickets = await this.createTickets(userId, eventId, quantity, session.id, origin);
    return tickets;
  }

  async createTickets(userId: string, eventId: string, quantity: number, paymentId: string, origin: string) {
    const event = await this.findByIdWithTicketCount(eventId);
    const remaining = event.maxTickets ? event.maxTickets - event.tickets.length : null;
    if (remaining !== null && quantity > remaining) {
      throw new BadRequestException('Not enough tickets remaining');
    }

    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');

    const tickets = await this.prisma.$transaction(async (tx) => {
      const created: { id: string; qrCodeValue: string; status: string }[] = [];
      for (let i = 0; i < quantity; i++) {
        const ticket = await tx.ticket.create({
          data: {
            eventId,
            userId,
            qrCodeValue: crypto.randomUUID(),
            paymentId,
            stripeSessionId: paymentId === 'free' ? null : paymentId,
            status: TicketStatus.VALID
          }
        });
        created.push(ticket);
      }
      return created;
    });

    const cardUrl = `${origin}/dashboard/tickets`;
    await this.emailService.sendTicket(user.email, event.title, cardUrl).catch(() => {
      // Log and continue if email fails
    });

    return tickets;
  }

  async getUserTickets(userId: string) {
    return this.prisma.ticket.findMany({
      where: { userId, deletedAt: null },
      orderBy: { purchaseDatetime: 'desc' },
      include: { event: true }
    });
  }

  async getTicketForUser(ticketId: string, userId: string) {
    const ticket = await this.prisma.ticket.findFirst({
      where: { id: ticketId, userId, deletedAt: null },
      include: { event: true, user: { select: { id: true, name: true, email: true } } }
    });
    if (!ticket) throw new NotFoundException('Ticket not found');
    return ticket;
  }

  async generateQrDataUrl(qrCodeValue: string) {
    return QRCode.toDataURL(qrCodeValue, { width: 256, margin: 2 });
  }

  async validateTicket(qrCodeValue: string) {
    const ticket = await this.prisma.ticket.findUnique({
      where: { qrCodeValue, deletedAt: null },
      include: {
        event: true,
        user: { select: { id: true, name: true, email: true } }
      }
    });
    if (!ticket) throw new NotFoundException('Ticket not found');
    if (ticket.status === TicketStatus.USED) throw new BadRequestException('Ticket already used');
    if (ticket.status === TicketStatus.CANCELLED) throw new BadRequestException('Ticket cancelled');

    const updated = await this.prisma.ticket.update({
      where: { id: ticket.id },
      data: { status: TicketStatus.USED },
      include: { event: true, user: { select: { id: true, name: true, email: true } } }
    });

    return updated;
  }
}
