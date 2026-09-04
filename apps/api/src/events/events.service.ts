import { Injectable, NotFoundException, BadRequestException, ForbiddenException, Inject } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../core/prisma/prisma.service.js';
import type { PaymentsService } from '../payments/payments.service.js';
import { GoCardlessService } from '../payments/gocardless.service.js';
import type { GoCardlessPaymentResource } from '../payments/gocardless-webhook.types.js';
import { EmailQueueService } from '../email/email-queue.service.js';
import type Stripe from 'stripe';
import type { PaymentMethodOption } from '@kentslsc/shared';
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
  existingPaymentId?: string;
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
    private readonly emailQueueService: EmailQueueService,
    private readonly configService: ConfigService<EnvConfig, true>,
    private readonly goCardlessService: GoCardlessService
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
        orderBy: [{ isFeatured: 'desc' }, { startDatetime: 'asc' }],
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

  async findByIdWithTicketCountAdmin(id: string) {
    const event = await this.findByIdWithTicketCount(id, false);
    const soldCount = event._count.tickets;
    const remainingCount = event.maxTickets != null ? event.maxTickets - soldCount : null;
    return { ...event, soldCount, remainingCount };
  }

  async featureEventFree(id: string) {
    const event = await this.prisma.event.findFirst({ where: { id, deletedAt: null } });
    if (!event) throw new NotFoundException('Event not found');

    const featuredUntil = new Date();
    featuredUntil.setDate(featuredUntil.getDate() + 30);

    return this.prisma.event.update({
      where: { id },
      data: { isFeatured: true, featuredUntil }
    });
  }

  async unfeatureEvent(id: string) {
    const event = await this.prisma.event.findFirst({ where: { id, deletedAt: null } });
    if (!event) throw new NotFoundException('Event not found');

    return this.prisma.event.update({
      where: { id },
      data: { isFeatured: false, featuredUntil: null }
    });
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
        externalTicketingUrl: dto.externalTicketingUrl || null,
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
        ...(dto.externalTicketingUrl !== undefined && {
          externalTicketingUrl: dto.externalTicketingUrl || null
        }),
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

  async recordExternalTicketClick(
    eventId: string,
    userId: string | undefined,
    ipAddress: string | undefined,
    userAgent: string | undefined
  ) {
    const event = await this.findById(eventId);
    if (!event.externalTicketingUrl) {
      throw new BadRequestException('Event does not use external ticketing');
    }
    const click = await this.prisma.eventExternalTicketClick.create({
      data: {
        eventId,
        userId,
        url: event.externalTicketingUrl,
        ipAddress,
        userAgent
      }
    });
    return { url: event.externalTicketingUrl, click };
  }

  async generateTickets(adminUserId: string, eventId: string, dto: GenerateTicketsDto) {
    const event = await this.findByIdWithTicketCount(eventId);
    if (event.externalTicketingUrl) {
      throw new BadRequestException('Tickets for this event are sold through an external platform');
    }
    const prefix = dto.prefix?.trim() || event.title.replace(/\s+/g, '-').slice(0, 8).toUpperCase();

    const remaining = event.maxTickets ? event.maxTickets - event._count.tickets : null;
    if (remaining !== null && dto.quantity > remaining) {
      throw new BadRequestException(`Only ${remaining} tickets remaining`);
    }

    let recipientUserId = dto.userId ?? adminUserId;
    let paymentDetails: TicketPaymentDetails = {
      channel: 'manual',
      currency: 'GBP',
      grossAmount: 0,
      processingFee: 0,
      netAmount: 0,
      sourceType: PaymentSourceType.MANUAL,
      notes: `Support-issued by ${adminUserId}: ${dto.notes ?? 'No notes'}`
    };

    if (dto.paymentId) {
      const payment = await this.prisma.payment.findUnique({ where: { id: dto.paymentId } });
      if (!payment) throw new NotFoundException('Payment not found');
      if (payment.paymentStatus !== PaymentStatus.COMPLETED) {
        throw new BadRequestException('Only completed payments can be attached to tickets');
      }
      if (payment.paymentChannel !== 'stripe' || payment.paymentMethod !== 'card') {
        throw new BadRequestException('Payment must be a Stripe card payment');
      }
      if (
        payment.sourceType !== PaymentSourceType.TICKET &&
        payment.sourceType !== PaymentSourceType.MANUAL
      ) {
        throw new BadRequestException('Payment is not eligible for ticket issuance');
      }
      if (payment.eventId && payment.eventId !== eventId) {
        throw new BadRequestException('Payment belongs to a different event');
      }
      if (dto.userId && payment.userId && dto.userId !== payment.userId) {
        throw new BadRequestException('Payment belongs to a different user');
      }
      if (!dto.userId && payment.userId) recipientUserId = payment.userId;

      paymentDetails = {
        channel: payment.paymentChannel,
        existingPaymentId: payment.id,
        method: payment.paymentMethod,
        currency: payment.currency,
        grossAmount: Math.round(Number(payment.grossAmount) * 100),
        processingFee: Math.round(Number(payment.processingFee) * 100),
        netAmount: Math.round(Number(payment.netAmount) * 100),
        sourceType: PaymentSourceType.TICKET,
        notes: `Attached to tickets by support ${adminUserId}: ${dto.notes ?? 'No notes'}`
      };
    }

    const tickets = await this.createTickets(
      recipientUserId,
      eventId,
      dto.quantity,
      this.configService.get('FRONTEND_URL', { infer: true }),
      paymentDetails,
      prefix
    );

    return { tickets, totalGenerated: tickets.length };
  }

  /**
   * Find completed payments that can be attached to tickets for a given event
   * and user. This is used by support staff when manually issuing tickets so
   * they only see revenue-report rows that are actually eligible for ticket
   * linkage.
   */
  async findAttachablePayments(eventId: string, userId: string) {
    await this.findById(eventId);

    const attachedTickets = await this.prisma.ticket.findMany({
      where: { paymentId: { not: null }, deletedAt: null },
      select: { paymentId: true }
    });
    const attachedPaymentIds = attachedTickets.flatMap((ticket) =>
      ticket.paymentId ? [ticket.paymentId] : []
    );

    const payments = await this.prisma.payment.findMany({
      where: {
        ...(attachedPaymentIds.length > 0 ? { id: { notIn: attachedPaymentIds } } : {}),
        paymentStatus: PaymentStatus.COMPLETED,
        paymentChannel: 'stripe',
        paymentMethod: 'card',
        sourceType: { in: [PaymentSourceType.TICKET, PaymentSourceType.MANUAL] },
        AND: [{ OR: [{ userId }, { userId: null }] }, { OR: [{ eventId }, { eventId: null }] }],
        deletedAt: null
      },
      orderBy: { purchasedAt: 'desc' },
      include: {
        event: { select: { id: true, title: true } },
        user: { select: { id: true, name: true, email: true } }
      }
    });

    return payments.map((p) => ({
      id: p.id,
      receiptNumber: p.receiptNumber,
      date: (p.purchasedAt ?? p.createdAt).toISOString(),
      description: p.description,
      currency: p.currency,
      grossAmount: Number(p.grossAmount),
      paymentStatus: p.paymentStatus,
      sourceType: p.sourceType,
      event: p.event,
      user: p.user
    }));
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

  async createCheckoutSession(
    userId: string,
    dto: PurchaseTicketsDto
  ): Promise<
    | { free: true; tickets: Awaited<ReturnType<EventsService['createTickets']>> }
    | { free: false; sessionId: string; url: string; provider: string; clientSecret?: string }
  > {
    const event = await this.findById(dto.eventId);
    if (!event.isPublished) throw new ForbiddenException('Event is not published');
    if (event.startDatetime < new Date()) throw new BadRequestException('Event has already started');
    if (event.externalTicketingUrl) {
      throw new BadRequestException('Tickets for this event are sold through an external platform');
    }

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
      select: { id: true, email: true, name: true }
    });
    if (!user) throw new NotFoundException('User not found');

    const settings = await this.paymentsService.resolveCheckoutMethod(dto.paymentMethod);
    if (settings.provider === 'gocardless') {
      return this.createGoCardlessCheckoutSession(user, event, dto, totalAmount, origin, settings.method);
    }

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

  /**
   * GoCardless variant of createCheckoutSession. Creates a one-off billing
   * request (BACS direct debit by default, Instant Bank Pay when
   * `paymentScheme` is `faster_payments`) for the ticket total including the
   * processing fee, and records a pending Payment row keyed by the billing
   * request id. The fulfilment handler completes that row in place and issues
   * the tickets.
   */
  private async createGoCardlessCheckoutSession(
    user: { id: string; email: string; name: string | null },
    event: { id: string; title: string; ticketPrice: number | unknown },
    dto: PurchaseTicketsDto,
    totalAmount: number,
    origin: string,
    method: PaymentMethodOption = 'direct_debit'
  ): Promise<Extract<Awaited<ReturnType<EventsService['createCheckoutSession']>>, { free: false }>> {
    const feeResult = this.paymentsService.calculateProcessingFee(totalAmount);
    // An explicit Instant Bank Pay choice maps to faster_payments; otherwise
    // the legacy paymentScheme (default bacs) applies.
    const scheme = method === 'instant_bank_pay' ? 'faster_payments' : (dto.paymentScheme ?? 'bacs');
    const customerId = await this.goCardlessService.getOrCreateCustomer(user.id);

    const checkout = await this.goCardlessService.createBillingRequestFlow({
      plan: 'one_off',
      amountPence: feeResult.gross,
      description: event.title,
      scheme,
      customerId,
      metadata: {
        type: 'event_ticket',
        eventId: dto.eventId,
        userId: user.id,
        quantity: String(dto.quantity),
        netAmount: String(feeResult.net),
        processingFee: String(feeResult.fee),
        grossAmount: String(feeResult.gross)
      },
      redirectUri: `${origin}/dashboard/tickets?success=1&session_id={BILLING_REQUEST_ID}&provider=gocardless`,
      exitUri: `${origin}/events/${dto.eventId}?canceled=1`
    });

    await this.prisma.payment.create({
      data: {
        userId: user.id,
        eventId: dto.eventId,
        paymentChannel: 'gocardless',
        paymentMethod: 'direct_debit',
        paymentStatus: PaymentStatus.PENDING,
        providerCheckoutId: checkout.id,
        currency: 'GBP',
        grossAmount: feeResult.gross / 100,
        processingFee: feeResult.fee / 100,
        netAmount: (feeResult.gross - feeResult.fee) / 100,
        description: `Ticket(s) for ${event.title}`,
        payerName: user.name,
        payerEmail: user.email,
        purchasedAt: new Date(),
        sourceType: PaymentSourceType.TICKET,
        metadata: {
          quantity: dto.quantity,
          ticketPrice: Number(event.ticketPrice),
          sessionRef: checkout.id
        } as unknown as Prisma.InputJsonValue
      }
    });

    return {
      free: false,
      sessionId: checkout.id,
      url: checkout.url,
      provider: checkout.provider
    };
  }

  async handleCheckoutCompleted(session: Stripe.Checkout.Session) {
    if (session.metadata?.type !== 'event_ticket') return null;
    if (session.payment_status && session.payment_status !== 'paid') {
      throw new BadRequestException(
        `Checkout session payment is not complete (payment_status: ${session.payment_status})`
      );
    }
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

  /**
   * Fulfil a confirmed GoCardless payment for event tickets.
   *
   * The pending Payment row created when the billing request flow started is
   * updated in place (no duplicate row); otherwise a completed row is created
   * keyed by the billing request id, which also makes ticket issuance
   * idempotent. Metadata keys mirror the Stripe session metadata conventions:
   * `type: 'event_ticket'`, `eventId`, `userId`, `quantity`, and the optional
   * `grossAmount`/`processingFee`/`netAmount` pence estimates.
   */
  async handleGoCardlessPaymentCompleted(
    payment: GoCardlessPaymentResource,
    metadata: Record<string, string>
  ) {
    if (metadata.type !== 'event_ticket') return null;
    const eventId = metadata.eventId;
    if (!eventId) return null;

    const billingRequestId = payment.links?.billing_request ?? null;

    // Stripe may retry the webhook; return existing tickets instead of creating duplicates.
    if (billingRequestId) {
      const existingTickets = await this.prisma.ticket.findMany({
        where: { stripeSessionId: billingRequestId, deletedAt: null },
        include: { event: true, user: { select: { id: true, name: true, email: true } } }
      });
      if (existingTickets.length > 0) {
        return existingTickets;
      }
    }

    const pendingPayment = billingRequestId
      ? await this.prisma.payment.findFirst({
          where: { providerCheckoutId: billingRequestId, paymentChannel: 'gocardless' }
        })
      : null;

    const userId = metadata.userId ?? pendingPayment?.userId;
    if (!userId) return null;
    const quantity = Number(
      metadata.quantity ?? (pendingPayment?.metadata as { quantity?: number } | null)?.quantity ?? 1
    );

    const origin = this.configService.get('FRONTEND_URL', { infer: true });
    const grossAmount = Number(metadata.grossAmount ?? payment.amount ?? 0);
    const processingFee = Number(metadata.processingFee ?? 0);
    const netAmount = Number(metadata.netAmount ?? grossAmount - processingFee);
    const purchasedAt = payment.created_at ? new Date(payment.created_at) : new Date();

    if (pendingPayment) {
      await this.prisma.payment.update({
        where: { id: pendingPayment.id },
        data: {
          userId,
          eventId,
          paymentStatus: PaymentStatus.COMPLETED,
          providerPaymentId: payment.id ?? null,
          currency: (payment.currency ?? 'GBP').toUpperCase(),
          grossAmount: grossAmount / 100,
          processingFee: processingFee / 100,
          netAmount: netAmount / 100,
          purchasedAt,
          sourceType: PaymentSourceType.TICKET,
          payerEmail: pendingPayment.payerEmail,
          payerName: pendingPayment.payerName
        }
      });
    }

    return this.createTickets(
      userId,
      eventId,
      quantity,
      origin,
      {
        ...(pendingPayment ? { existingPaymentId: pendingPayment.id } : {}),
        channel: 'gocardless',
        method: 'direct_debit',
        currency: (payment.currency ?? 'GBP').toUpperCase(),
        grossAmount,
        processingFee,
        netAmount,
        providerCheckoutId: billingRequestId,
        providerPaymentId: payment.id ?? null,
        purchasedAt,
        payerEmail: pendingPayment?.payerEmail ?? null,
        payerName: pendingPayment?.payerName ?? null,
        payerPhone: null,
        payerAddress: null,
        paymentStatus: PaymentStatus.COMPLETED,
        sourceType: PaymentSourceType.TICKET,
        notes: 'Ticket purchase via GoCardless Direct Debit'
      },
      undefined
    );
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

    const prefix = ticketPrefix?.trim() || event.title.replace(/\s+/g, '-').slice(0, 8).toUpperCase();
    const sessionRef = paymentDetails?.providerCheckoutId;

    const tickets = await this.prisma.$transaction(async (tx) => {
      // Lock the event row so concurrent ticket purchases for the same event are
      // serialised. This prevents overselling when two requests try to buy the
      // last remaining tickets at the same time.
      await tx.$executeRaw`SELECT id FROM events WHERE id = ${eventId} FOR UPDATE`;

      // Re-check capacity inside the transaction to avoid overselling.
      const sold = await tx.ticket.count({
        where: { eventId, status: { not: TicketStatus.CANCELLED }, deletedAt: null }
      });
      const txRemaining = event.maxTickets ? event.maxTickets - sold : null;
      if (txRemaining !== null && quantity > txRemaining) {
        throw new BadRequestException('Not enough tickets remaining');
      }

      const lastTicket = await tx.ticket.findFirst({
        where: { eventId, deletedAt: null },
        orderBy: { serialNumber: 'desc' },
        select: { serialNumber: true }
      });
      const startSerial = (lastTicket?.serialNumber ?? 0) + 1;

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

      let payment;
      if (paymentDetails?.existingPaymentId) {
        payment = await tx.payment.findUnique({ where: { id: paymentDetails.existingPaymentId } });
        if (!payment) throw new NotFoundException('Payment not found');
        if (payment.paymentStatus !== PaymentStatus.COMPLETED) {
          throw new BadRequestException('Only completed payments can be attached to tickets');
        }
        if (payment.paymentChannel !== 'stripe' && payment.paymentChannel !== 'gocardless') {
          throw new BadRequestException('Payment must be a Stripe card or GoCardless payment');
        }
        if (
          payment.sourceType !== PaymentSourceType.TICKET &&
          payment.sourceType !== PaymentSourceType.MANUAL
        ) {
          throw new BadRequestException('Payment is not eligible for ticket issuance');
        }
        if (payment.userId && payment.userId !== userId) {
          throw new BadRequestException('Payment belongs to a different user');
        }
        if (payment.eventId && payment.eventId !== eventId) {
          throw new BadRequestException('Payment belongs to a different event');
        }
        const existingForPayment = await tx.ticket.count({
          where: { paymentId: payment.id, deletedAt: null }
        });
        if (existingForPayment > 0) {
          throw new BadRequestException('Tickets already issued for this payment');
        }
      } else {
        payment = await tx.payment.create({
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
            ...(paymentDetails?.existingPaymentId
              ? { userId, eventId, sourceType: PaymentSourceType.TICKET }
              : {}),
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
    await this.emailQueueService.addSendTicketEmailJob({
      email: user.email,
      eventTitle: event.title,
      cardUrl,
      tickets
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
    await this.emailQueueService.addSendTicketEmailJob({
      email,
      eventTitle: ticket.event.title,
      cardUrl,
      tickets: [{ id: ticket.id, qrCodeValue: ticket.qrCodeValue }]
    });
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
  async confirmCheckoutSession(
    sessionId: string,
    provider: 'stripe' | 'paypal',
    currentUserId?: string
  ) {
    const existingTickets = await this.prisma.ticket.findMany({
      where: { stripeSessionId: sessionId, deletedAt: null },
      include: { event: true, user: { select: { id: true, name: true, email: true } } }
    });
    if (existingTickets.length > 0) {
      return { tickets: existingTickets, created: false };
    }

    if (provider === 'stripe') {
      const session = await this.paymentsService.getCheckoutSession(sessionId, currentUserId);
      if (session.status !== 'complete' || session.paymentStatus !== 'paid') {
        throw new BadRequestException(
          `Checkout session is not complete (status: ${session.status}, payment_status: ${session.paymentStatus})`
        );
      }
      const tickets = await this.handleCheckoutCompleted({
        id: sessionId,
        status: 'complete',
        payment_status: session.paymentStatus,
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
    const event = await this.findById(eventId);
    if (event.externalTicketingUrl) {
      throw new BadRequestException('Tickets for this event are sold through an external platform');
    }
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
