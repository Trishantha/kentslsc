import { Injectable, NotFoundException, BadRequestException, ForbiddenException, Inject } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../core/prisma/prisma.service.js';
import type { PaymentsService } from '../payments/payments.service.js';
import { EmailService } from '../email/email.service.js';
import type Stripe from 'stripe';
import QRCode from 'qrcode';
import type { CreateEventDto, UpdateEventDto, PurchaseTicketsDto, UpdateEventPostersDto, UpdateEventTicketDesignDto, GenerateTicketsDto } from './dto/index.js';
import type { EnvConfig } from '../core/config/env.validation.js';
import { TicketStatus, EventCategory, Prisma } from '@kentslsc/database';

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

  async listPublished(page = 1, limit = 20, filters?: { search?: string; upcoming?: boolean; category?: string }) {
    const where: {
      isPublished: boolean;
      deletedAt: null;
      category?: EventCategory;
      OR?: Record<string, unknown>[];
      startDatetime?: { gte: Date };
    } = {
      isPublished: true,
      deletedAt: null
    };

    if (filters?.category) {
      where.category = filters.category as EventCategory;
    }

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

    const [rows, total] = await Promise.all([
      this.prisma.event.findMany({
        where,
        orderBy: { startDatetime: 'asc' },
        take: limit,
        skip: (page - 1) * limit,
        include: {
          _count: {
            select: {
              tickets: {
                where: { status: { not: TicketStatus.CANCELLED }, deletedAt: null }
              }
            }
          }
        }
      }),
      this.prisma.event.count({ where })
    ]);

    const data = rows.map((event) => {
      const soldCount = event._count.tickets;
      const remainingCount = event.maxTickets != null ? event.maxTickets - soldCount : null;
      return { ...event, soldCount, remainingCount };
    });

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
        _count: {
          select: {
            tickets: {
              where: { status: { not: TicketStatus.CANCELLED }, deletedAt: null }
            }
          }
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
        category: dto.category ?? EventCategory.OTHER,
        imageUrl: dto.imageUrl,
        isPublished: dto.isPublished ?? false
      }
    });
  }

  async update(id: string, dto: UpdateEventDto) {
    if (dto.maxTickets !== undefined && dto.maxTickets != null) {
      const sold = await this.prisma.ticket.count({
        where: { eventId: id, status: { not: TicketStatus.CANCELLED }, deletedAt: null }
      });
      if (sold > dto.maxTickets) {
        throw new BadRequestException(
          `Cannot set max tickets below the ${sold} tickets already sold`
        );
      }
    }
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
        ...(dto.category !== undefined && { category: dto.category }),
        ...(dto.imageUrl !== undefined && { imageUrl: dto.imageUrl }),
        ...(dto.isPublished !== undefined && { isPublished: dto.isPublished })
      }
    });
  }

  async remove(id: string) {
    await this.findById(id);
    return this.prisma.event.update({ where: { id }, data: { deletedAt: new Date() } });
  }

  async updatePosterImages(id: string, dto: UpdateEventPostersDto) {
    await this.findById(id);
    return this.prisma.event.update({
      where: { id },
      data: {
        ...(dto.posterImageUrl !== undefined && { posterImageUrl: dto.posterImageUrl }),
        ...(dto.posterImages !== undefined && { posterImages: dto.posterImages as unknown as Prisma.InputJsonValue })
      }
    });
  }

  async updateTicketDesign(id: string, dto: UpdateEventTicketDesignDto) {
    await this.findById(id);
    return this.prisma.event.update({
      where: { id },
      data: {
        ...(dto.ticketDesign !== undefined && { ticketDesign: dto.ticketDesign as unknown as Prisma.InputJsonValue })
      }
    });
  }

  private async getNextTicketSerial(eventId: string) {
    const lastTicket = await this.prisma.ticket.findFirst({
      where: { eventId, deletedAt: null },
      orderBy: { serialNumber: 'desc' },
      select: { serialNumber: true }
    });
    return (lastTicket?.serialNumber ?? 0) + 1;
  }

  async generateTickets(adminUserId: string, eventId: string, dto: GenerateTicketsDto) {
    const event = await this.findByIdWithTicketCount(eventId);
    const prefix = dto.prefix?.trim() || event.title.replace(/\s+/g, '-').slice(0, 8).toUpperCase();

    const remaining = event.maxTickets ? event.maxTickets - event._count.tickets : null;
    if (remaining !== null && dto.quantity > remaining) {
      throw new BadRequestException(`Only ${remaining} tickets remaining`);
    }

    const startSerial = await this.getNextTicketSerial(eventId);

    const tickets = await this.prisma.$transaction(async (tx) => {
      const created: { id: string; qrCodeValue: string; serialNumber: number; ticketNumber: string; status: string }[] = [];
      for (let i = 0; i < dto.quantity; i++) {
        const serialNumber = startSerial + i;
        const ticketNumber = `${prefix}-${String(serialNumber).padStart(3, '0')}`;
        const ticket = await tx.ticket.create({
          data: {
            eventId,
            userId: adminUserId,
            qrCodeValue: crypto.randomUUID(),
            serialNumber,
            ticketNumber,
            paymentId: 'admin-generated',
            status: TicketStatus.VALID
          }
        });
        created.push({
          id: ticket.id,
          qrCodeValue: ticket.qrCodeValue,
          serialNumber: ticket.serialNumber ?? serialNumber,
          ticketNumber: ticket.ticketNumber ?? ticketNumber,
          status: ticket.status
        });
      }
      return created;
    });

    return { tickets, totalGenerated: tickets.length };
  }

  async listEventTickets(eventId: string) {
    await this.findById(eventId);
    const tickets = await this.prisma.ticket.findMany({
      where: { eventId, deletedAt: null },
      orderBy: { serialNumber: 'asc' },
      include: {
        user: { select: { id: true, name: true, email: true } }
      }
    });
    return { tickets };
  }

  async getRemainingCapacity(eventId: string) {
    const event = await this.findByIdWithTicketCount(eventId);
    if (!event.maxTickets) return null;
    return event.maxTickets - event._count.tickets;
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

    const checkout = await this.paymentsService.createCheckout({
      amount: totalAmount,
      currency: 'gbp',
      description: event.title,
      successUrl: `${origin}/dashboard/tickets?success=1`,
      cancelUrl: `${origin}/events/${dto.eventId}?canceled=1`,
      metadata: {
        eventId: dto.eventId,
        userId,
        quantity: String(dto.quantity),
        type: 'event_ticket'
      }
    });

    return { free: false, sessionId: checkout.id, url: checkout.url, provider: checkout.provider };
  }

  async handleCheckoutCompleted(session: Stripe.Checkout.Session) {
    if (session.metadata?.type !== 'event_ticket') return null;
    const eventId = session.metadata.eventId;
    const userId = session.metadata.userId;
    const quantity = Number(session.metadata.quantity || '1');

    if (!eventId || !userId) return null;

    const origin = this.configService.get('FRONTEND_URL', { infer: true });

    // Stripe may retry the webhook; return existing tickets instead of creating duplicates.
    const existingTickets = await this.prisma.ticket.findMany({
      where: { stripeSessionId: session.id, deletedAt: null },
      include: { event: true, user: { select: { id: true, name: true, email: true } } }
    });
    if (existingTickets.length > 0) {
      return existingTickets;
    }

    const tickets = await this.createTickets(userId, eventId, quantity, session.id, origin);
    return tickets;
  }

  async createTickets(userId: string, eventId: string, quantity: number, paymentId: string, origin: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');

    const event = await this.findByIdWithTicketCount(eventId);
    const remaining = event.maxTickets ? event.maxTickets - event._count.tickets : null;
    if (remaining !== null && quantity > remaining) {
      throw new BadRequestException('Not enough tickets remaining');
    }

    const startSerial = await this.getNextTicketSerial(eventId);
    const prefix = event.title.replace(/\s+/g, '-').slice(0, 8).toUpperCase();

    const tickets = await this.prisma.$transaction(async (tx) => {
      // Re-check capacity inside the transaction to avoid overselling.
      const sold = await tx.ticket.count({
        where: { eventId, status: { not: TicketStatus.CANCELLED }, deletedAt: null }
      });
      const txRemaining = event.maxTickets ? event.maxTickets - sold : null;
      if (txRemaining !== null && quantity > txRemaining) {
        throw new BadRequestException('Not enough tickets remaining');
      }

      // Defensive idempotency guard: do not issue tickets twice for the same Stripe session.
      if (paymentId !== 'free') {
        const existingForSession = await tx.ticket.count({
          where: { stripeSessionId: paymentId, deletedAt: null }
        });
        if (existingForSession > 0) {
          throw new BadRequestException('Tickets already issued for this payment session');
        }
      }

      const created: { id: string; qrCodeValue: string; serialNumber: number; ticketNumber: string; status: string }[] = [];
      for (let i = 0; i < quantity; i++) {
        const serialNumber = startSerial + i;
        const ticketNumber = `${prefix}-${String(serialNumber).padStart(3, '0')}`;
        const ticket = await tx.ticket.create({
          data: {
            eventId,
            userId,
            qrCodeValue: crypto.randomUUID(),
            serialNumber,
            ticketNumber,
            paymentId,
            stripeSessionId: paymentId === 'free' ? null : paymentId,
            status: TicketStatus.VALID
          }
        });
        created.push({
          id: ticket.id,
          qrCodeValue: ticket.qrCodeValue,
          serialNumber: ticket.serialNumber ?? serialNumber,
          ticketNumber: ticket.ticketNumber ?? ticketNumber,
          status: ticket.status
        });
      }
      return created;
    });

    const cardUrl = `${origin}/dashboard/tickets`;
    await this.emailService
      .sendTicket(user.email, event.title, cardUrl, tickets)
      .catch(() => {
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

  async resendTicketEmail(ticketId: string, userId: string, email: string) {
    const ticket = await this.getTicketForUser(ticketId, userId);
    if (ticket.status === TicketStatus.CANCELLED) {
      throw new BadRequestException('Ticket has been cancelled');
    }
    if (!ticket.event) {
      throw new NotFoundException('Event not found');
    }
    const origin = this.configService.get('FRONTEND_URL', { infer: true });
    const cardUrl = `${origin}/dashboard/tickets`;
    await this.emailService.sendTicket(email, ticket.event.title, cardUrl, [
      { id: ticket.id, qrCodeValue: ticket.qrCodeValue }
    ]);
    return { sent: true };
  }

  async generateQrDataUrl(qrCodeValue: string) {
    return QRCode.toDataURL(qrCodeValue, { width: 256, margin: 2 });
  }

  async previewTicket(qrCodeValue: string) {
    const ticket = await this.prisma.ticket.findUnique({
      where: { qrCodeValue, deletedAt: null },
      include: {
        event: true,
        user: { select: { id: true, name: true, email: true } }
      }
    });
    if (!ticket) throw new NotFoundException('Ticket not found');
    const eventExpired = ticket.event.endDatetime < new Date();
    return { ...ticket, eventExpired };
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
    if (ticket.event.endDatetime < new Date()) throw new BadRequestException('Event has ended');
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
