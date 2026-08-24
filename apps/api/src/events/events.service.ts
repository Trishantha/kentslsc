import { Injectable, NotFoundException, BadRequestException, ForbiddenException, Inject } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../core/prisma/prisma.service.js';
import type { PaymentsService } from '../payments/payments.service.js';
import { EmailService } from '../email/email.service.js';
import type Stripe from 'stripe';
import QRCode from 'qrcode';
import type { CreateEventDto, UpdateEventDto, PurchaseTicketsDto, UpdateEventPostersDto, UpdateEventTicketDesignDto, GenerateTicketsDto } from './dto/index.js';
import type { EnvConfig } from '../core/config/env.validation.js';
import {
  TicketStatus,
  EventCategory,
  Prisma,
  PaymentStatus,
  PaymentSourceType
} from '@kentslsc/database';

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

interface PayerAddress {
  line1?: string | null;
  line2?: string | null;
  city?: string | null;
  postal_code?: string | null;
  country?: string | null;
}

interface TicketPaymentDetails {
  channel: string;
  method?: string | null;
  currency?: string;
  grossAmount: number; // minor unit, e.g. pence
  processingFee: number; // minor unit
  netAmount: number; // minor unit
  providerCheckoutId?: string | null;
  providerPaymentId?: string | null;
  purchasedAt?: Date | null;
  payerEmail?: string | null;
  payerName?: string | null;
  payerPhone?: string | null;
  payerAddress?: PayerAddress | null;
  paymentStatus?: PaymentStatus;
  sourceType?: PaymentSourceType;
  notes?: string;
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

  async findByIdWithTicketCount(id: string, requirePublished = false) {
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
    if (requirePublished && !event.isPublished) {
      throw new NotFoundException('Event not found');
    }
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

    const tickets = await this.createTickets(
      adminUserId,
      eventId,
      dto.quantity,
      this.configService.get('FRONTEND_URL', { infer: true }),
      {
        channel: 'manual',
        currency: 'GBP',
        grossAmount: 0,
        processingFee: 0,
        netAmount: 0,
        sourceType: PaymentSourceType.MANUAL,
        notes: `Admin-generated tickets: ${dto.notes ?? 'No notes'}`
      },
      prefix
    );

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
      const tickets = await this.createTickets(
        userId,
        dto.eventId,
        dto.quantity,
        origin,
        {
          channel: 'free',
          currency: 'GBP',
          grossAmount: 0,
          processingFee: 0,
          netAmount: 0,
          sourceType: PaymentSourceType.MANUAL,
          notes: 'Free ticket'
        }
      );
      return { free: true, tickets };
    }

    const user = await this.prisma.user.findUnique({
      where: { id: userId, deletedAt: null },
      select: { id: true, email: true }
    });
    if (!user) throw new NotFoundException('User not found');

    const stripeCustomerId = await this.paymentsService.getOrCreateStripeCustomer(user.id, user.email);

    const checkout = await this.paymentsService.createCheckout({
      amount: totalAmount,
      currency: 'gbp',
      description: event.title,
      customer: stripeCustomerId,
      successUrl: `${origin}/dashboard/tickets?success=1&session_id={CHECKOUT_SESSION_ID}&provider=stripe`,
      cancelUrl: `${origin}/events/${dto.eventId}?canceled=1`,
      uiMode: 'embedded_page',
      metadata: {
        eventId: dto.eventId,
        userId,
        quantity: String(dto.quantity),
        type: 'event_ticket'
      }
    });

    return {
      free: false,
      sessionId: checkout.id,
      url: checkout.url,
      provider: checkout.provider,
      clientSecret: checkout.clientSecret
    };
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

    const currency = (session.currency ?? 'gbp').toUpperCase();
    const grossAmount = Number(session.metadata?.grossAmount ?? session.amount_total ?? 0);
    const processingFee = Number(session.metadata?.processingFee ?? 0);
    const netAmount = Number(session.metadata?.netAmount ?? grossAmount - processingFee);
    const purchasedAt = session.created ? new Date(session.created * 1000) : new Date();
    const customer = session.customer_details;

    const tickets = await this.createTickets(
      userId,
      eventId,
      quantity,
      origin,
      {
        channel: 'stripe',
        method: session.payment_method_types?.[0],
        currency,
        grossAmount,
        processingFee,
        netAmount,
        providerCheckoutId: session.id,
        providerPaymentId:
          typeof session.payment_intent === 'string'
            ? session.payment_intent
            : session.payment_intent?.id ?? null,
        purchasedAt,
        payerEmail: customer?.email ?? session.customer_email ?? null,
        payerName: customer?.name ?? null,
        payerPhone: customer?.phone ?? null,
        payerAddress: customer?.address ?? null,
        paymentStatus: PaymentStatus.COMPLETED,
        sourceType: PaymentSourceType.TICKET,
        notes: `Ticket purchase for event via Stripe Checkout`
      }
    );
    return tickets;
  }

  async createTickets(
    userId: string,
    eventId: string,
    quantity: number,
    origin: string,
    paymentDetails?: TicketPaymentDetails,
    ticketPrefix?: string
  ) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');

    const event = await this.findByIdWithTicketCount(eventId);
    const remaining = event.maxTickets ? event.maxTickets - event._count.tickets : null;
    if (remaining !== null && quantity > remaining) {
      throw new BadRequestException('Not enough tickets remaining');
    }

    const startSerial = await this.getNextTicketSerial(eventId);
    const prefix = ticketPrefix?.trim() || event.title.replace(/\s+/g, '-').slice(0, 8).toUpperCase();
    const sessionRef = paymentDetails?.providerCheckoutId;

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
      if (sessionRef) {
        const existingForSession = await tx.ticket.count({
          where: { stripeSessionId: sessionRef, deletedAt: null }
        });
        if (existingForSession > 0) {
          throw new BadRequestException('Tickets already issued for this payment session');
        }
      }

      const currency = paymentDetails?.currency ?? 'GBP';
      const grossAmount = paymentDetails?.grossAmount ?? 0;
      const processingFee = paymentDetails?.processingFee ?? 0;
      const netAmount = paymentDetails?.netAmount ?? grossAmount;

      const payment = await tx.payment.create({
        data: {
          userId,
          eventId,
          paymentChannel: paymentDetails?.channel ?? 'manual',
          paymentMethod: paymentDetails?.method ?? null,
          paymentStatus: paymentDetails?.paymentStatus ?? PaymentStatus.COMPLETED,
          providerCheckoutId: sessionRef ?? null,
          providerPaymentId: paymentDetails?.providerPaymentId ?? null,
          currency,
          grossAmount: grossAmount / 100,
          processingFee: processingFee / 100,
          netAmount: netAmount / 100,
          description: `Ticket(s) for ${event.title}`,
          notes: paymentDetails?.notes ?? null,
          payerName: paymentDetails?.payerName ?? user.name,
          payerEmail: paymentDetails?.payerEmail ?? user.email,
          payerPhone: paymentDetails?.payerPhone ?? user.phone ?? null,
          payerAddressLine1: paymentDetails?.payerAddress?.line1 ?? null,
          payerAddressLine2: paymentDetails?.payerAddress?.line2 ?? null,
          payerCity: paymentDetails?.payerAddress?.city ?? null,
          payerPostcode: paymentDetails?.payerAddress?.postal_code ?? null,
          payerCountry: paymentDetails?.payerAddress?.country ?? null,
          purchasedAt: paymentDetails?.purchasedAt ?? new Date(),
          sourceType: paymentDetails?.sourceType ?? PaymentSourceType.MANUAL,
          ...(paymentDetails && sessionRef
            ? {
                metadata: {
                  quantity,
                  ticketPrice: Number(event.ticketPrice),
                  sessionRef
                } as unknown as Prisma.InputJsonValue
              }
            : {})
        }
      });

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
            paymentId: payment.id,
            stripeSessionId: sessionRef ?? null,
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

      // For multi-ticket purchases, keep a reference to all ticket ids in the payment metadata.
      if (created.length > 1 || paymentDetails?.sourceType === PaymentSourceType.TICKET) {
        await tx.payment.update({
          where: { id: payment.id },
          data: {
            sourceId: created.length === 1 ? created[0]?.id ?? payment.id : payment.id,
            metadata: {
              quantity,
              ticketIds: created.map((t) => t.id),
              ticketNumbers: created.map((t) => t.ticketNumber),
              ticketPrice: Number(event.ticketPrice),
              sessionRef: sessionRef ?? null
            } as unknown as Prisma.InputJsonValue
          }
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
      select: {
        id: true,
        qrCodeValue: true,
        status: true,
        purchaseDatetime: true,
        ticketNumber: true,
        serialNumber: true,
        event: {
          select: {
            id: true,
            title: true,
            startDatetime: true,
            endDatetime: true,
            location: true,
            imageUrl: true,
            ticketDesign: true
          }
        }
      }
    });
  }

  async getTicketForUser(ticketId: string, userId: string) {
    const ticket = await this.prisma.ticket.findFirst({
      where: { id: ticketId, userId, deletedAt: null },
      select: {
        id: true,
        qrCodeValue: true,
        status: true,
        purchaseDatetime: true,
        ticketNumber: true,
        serialNumber: true,
        event: {
          select: {
            id: true,
            title: true,
            startDatetime: true,
            endDatetime: true,
            location: true,
            imageUrl: true,
            ticketDesign: true
          }
        },
        user: { select: { id: true, name: true, email: true } }
      }
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

  /**
   * Explicit success confirmation for ticket purchases.
   *
   * The frontend calls this when the payer returns from Stripe/PayPal. It
   * protects against webhooks that are delayed, misconfigured, or dropped:
   * if the tickets do not already exist, we ask the gateway for the session
   * status and create them immediately.
   */
  async confirmCheckoutSession(sessionId: string, provider: 'stripe' | 'paypal') {
    const existingTickets = await this.prisma.ticket.findMany({
      where: { stripeSessionId: sessionId, deletedAt: null },
      include: { event: true, user: { select: { id: true, name: true, email: true } } }
    });
    if (existingTickets.length > 0) {
      return { tickets: existingTickets, created: false };
    }

    if (provider === 'stripe') {
      const session = await this.paymentsService.getCheckoutSession(sessionId);
      if (session.status !== 'complete') {
        throw new BadRequestException(`Checkout session is not complete (status: ${session.status})`);
      }
      const tickets = await this.handleCheckoutCompleted({
        id: sessionId,
        status: 'complete',
        currency: session.currency ?? 'gbp',
        amount_total: session.amountTotal,
        metadata: session.metadata as Record<string, string>,
        customer_details: session.customerEmail
          ? { email: session.customerEmail, name: session.customerEmail }
          : undefined,
        payment_intent: session.paymentIntentId ?? null,
        customer_email: session.customerEmail ?? undefined,
        created: Math.floor(Date.now() / 1000)
      } as unknown as Stripe.Checkout.Session);
      return { tickets: tickets ?? [], created: true };
    }

    // PayPal confirmation would need an order-lookup helper; for now return early.
    throw new BadRequestException('PayPal confirmation is not yet supported');
  }

  /**
   * Manual admin ticket issuance for an existing completed checkout.
   *
   * Use this to issue tickets for historic purchases where the webhook
   * failed or was never received.
   */
  async issueTicketsFromExistingSession(
    adminUserId: string,
    eventId: string,
    sessionId: string,
    provider: 'stripe' | 'paypal',
    quantity = 1
  ) {
    const existingTickets = await this.prisma.ticket.findMany({
      where: { stripeSessionId: sessionId, deletedAt: null },
      include: { event: true, user: { select: { id: true, name: true, email: true } } }
    });
    if (existingTickets.length > 0) {
      return { tickets: existingTickets, created: false };
    }

    const origin = this.configService.get('FRONTEND_URL', { infer: true });

    if (provider === 'stripe') {
      const session = await this.paymentsService.getCheckoutSession(sessionId);
      const metadata = session.metadata ?? {};
      const eventIdFromSession = metadata.eventId;
      const userIdFromSession = metadata.userId;
      const quantityFromSession = Number(metadata.quantity || quantity);

      if (!eventIdFromSession || !userIdFromSession) {
        throw new BadRequestException('Session metadata is missing event or user information');
      }
      if (eventIdFromSession !== eventId) {
        throw new BadRequestException('Session does not match the requested event');
      }

      const tickets = await this.createTickets(
        userIdFromSession,
        eventIdFromSession,
        quantityFromSession,
        origin,
        {
          channel: 'stripe',
          method: 'card',
          currency: (session.currency ?? 'gbp').toUpperCase(),
          grossAmount: session.amountTotal,
          processingFee: 0,
          netAmount: session.amountTotal,
          providerCheckoutId: sessionId,
          providerPaymentId: session.paymentIntentId ?? null,
          purchasedAt: new Date(),
          payerEmail: session.customerEmail ?? null,
          payerName: null,
          payerPhone: null,
          payerAddress: null,
          paymentStatus: PaymentStatus.COMPLETED,
          sourceType: PaymentSourceType.TICKET,
          notes: `Manually issued by admin ${adminUserId} after missing webhook`
        }
      );
      return { tickets, created: true };
    }

    throw new BadRequestException('PayPal manual issuance is not yet supported');
  }
}
