import {
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type Stripe from 'stripe';
import type { PaymentMethodOption } from '@kentslsc/shared';
import { PrismaService } from '../core/prisma/prisma.service.js';
import { AiService } from '../ai/ai.service.js';
import { PaymentsService } from '../payments/payments.service.js';
import { GoCardlessService } from '../payments/gocardless.service.js';
import type { GoCardlessPaymentResource } from '../payments/gocardless-webhook.types.js';
import { EmailService } from '../email/email.service.js';
import { SupabaseStorageService } from '../core/supabase/supabase.service.js';
import { FundraiserStatus } from '@kentslsc/shared';
import { PaymentStatus, PaymentSourceType } from '@kentslsc/database';
import type { CreateFundraiserUpdateDto } from './dto/create-fundraiser-update.dto.js';
import type { RecordOfflineDonationDto } from './dto/record-offline-donation.dto.js';
import type { CreateDonationDto } from './dto/create-donation.dto.js';
import type { CreateFundraiserDto } from './dto/create-fundraiser.dto.js';

const MILESTONE_PERCENTAGES = [25, 50, 75, 100] as const;

const ORGANIZER_SELECT = {
  id: true,
  name: true,
  firstName: true,
  lastName: true
} as const;

@Injectable()
export class FundraisingService {
  private readonly logger = new Logger(FundraisingService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly ai: AiService,
    private readonly payments: PaymentsService,
    private readonly configService: ConfigService,
    private readonly emailService: EmailService,
    private readonly supabase: SupabaseStorageService,
    private readonly goCardlessService: GoCardlessService
  ) {}

  async listActive(category?: string, page = 1, limit = 20) {
    const now = new Date();
    const where: any = {
      status: FundraiserStatus.ACTIVE,
      isActive: true,
      deletedAt: null,
      startDate: { lte: now },
      endDate: { gte: now }
    };
    if (category) where.category = category;

    const skip = (page - 1) * limit;
    const [items, total] = await Promise.all([
      this.prisma.fundraiser.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
        include: { organizer: { select: ORGANIZER_SELECT } }
      }),
      this.prisma.fundraiser.count({ where })
    ]);
    return { items: items.map((i) => this.toResponse(i)), total, page, limit };
  }

  async listAll(page = 1, limit = 20) {
    const skip = (page - 1) * limit;
    const [items, total] = await Promise.all([
      this.prisma.fundraiser.findMany({
        where: { deletedAt: null },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
        include: { organizer: { select: ORGANIZER_SELECT } }
      }),
      this.prisma.fundraiser.count({ where: { deletedAt: null } })
    ]);
    return { items: items.map((i) => this.toResponse(i)), total, page, limit };
  }

  async listPendingApproval() {
    const items = await this.prisma.fundraiser.findMany({
      where: { status: FundraiserStatus.PENDING_APPROVAL, deletedAt: null },
      orderBy: { createdAt: 'asc' },
      include: { organizer: { select: ORGANIZER_SELECT } }
    });
    return items.map((i) => this.toResponse(i));
  }

  async listByOrganizer(userId: string) {
    const items = await this.prisma.fundraiser.findMany({
      where: { organizerId: userId, deletedAt: null },
      orderBy: { createdAt: 'desc' },
      include: { organizer: { select: ORGANIZER_SELECT } }
    });
    return items.map((i) => this.toResponse(i));
  }

  async findById(id: string) {
    const item = await this.prisma.fundraiser.findUnique({
      where: { id, deletedAt: null },
      include: {
        organizer: { select: ORGANIZER_SELECT },
        updates: { orderBy: { createdAt: 'desc' }, include: { author: { select: ORGANIZER_SELECT } } },
        photos: { orderBy: { sortOrder: 'asc' } }
      }
    });
    if (!item) throw new NotFoundException('Fundraiser not found');
    return this.toResponse(item);
  }

  async create(data: CreateFundraiserDto, organizerId?: string) {
    // Admins get ACTIVE immediately; member-created campaigns start as PENDING_APPROVAL
    const status = organizerId ? FundraiserStatus.PENDING_APPROVAL : FundraiserStatus.ACTIVE;
    const item = await this.prisma.fundraiser.create({
      data: {
        title: data.title,
        description: data.description,
        targetAmount: data.targetAmount,
        imageUrl: data.imageUrl || null,
        imagePath: data.imagePath || null,
        category: data.category,
        startDate: data.startDate ?? new Date(),
        endDate: data.endDate ?? new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        isActive: data.isActive ?? true,
        status,
        organizerId: organizerId ?? null,
        aiSummary: null,
        photos: {
          create: data.photos?.map((p: { url: string; path?: string }, idx: number) => ({
            url: p.url,
            path: p.path || null,
            sortOrder: idx
          })) ?? []
        }
      },
      include: {
        organizer: { select: ORGANIZER_SELECT },
        photos: { orderBy: { sortOrder: 'asc' } }
      }
    });

    return this.toResponse(item);
  }

  async update(id: string, data: Partial<CreateFundraiserDto>) {
    const existing = await this.findById(id);

    // Delete old Supabase object when image is replaced
    if (data.imagePath !== undefined && existing.imagePath && existing.imagePath !== data.imagePath) {
      await this.supabase.delete(existing.imagePath).catch((e) =>
        this.logger.warn(`Failed to delete old fundraiser image ${existing.imagePath}: ${String(e)}`)
      );
    }

    // Sync gallery photos when the full photos array is supplied
    if (data.photos !== undefined) {
      const removedPaths = ((existing.photos ?? []) as { path?: string | null }[])
        .map((p) => p.path)
        .filter((p): p is string => Boolean(p));
      for (const path of removedPaths) {
        await this.supabase.delete(path).catch((e) =>
          this.logger.warn(`Failed to delete old fundraiser gallery photo ${path}: ${String(e)}`)
        );
      }
    }

    const item = await this.prisma.fundraiser.update({
      where: { id },
      data: {
        ...(data.title !== undefined && { title: data.title }),
        ...(data.description !== undefined && { description: data.description }),
        ...(data.targetAmount !== undefined && { targetAmount: data.targetAmount }),
        ...(data.imageUrl !== undefined && { imageUrl: data.imageUrl || null }),
        ...(data.imagePath !== undefined && { imagePath: data.imagePath || null }),
        ...(data.category !== undefined && { category: data.category }),
        ...(data.startDate !== undefined && { startDate: data.startDate }),
        ...(data.endDate !== undefined && { endDate: data.endDate }),
        ...(data.isActive !== undefined && { isActive: data.isActive }),
        ...(data.photos !== undefined && {
          photos: {
            deleteMany: {},
            create: data.photos.map((p: { url: string; path?: string }, idx: number) => ({
              url: p.url,
              path: p.path || null,
              sortOrder: idx
            }))
          }
        })
      },
      include: {
        organizer: { select: ORGANIZER_SELECT },
        photos: { orderBy: { sortOrder: 'asc' } }
      }
    });

    return this.toResponse(item);
  }

  async remove(id: string) {
    const item = await this.findById(id);
    if (item.imagePath) {
      await this.supabase.delete(item.imagePath).catch((e) =>
        this.logger.warn(`Failed to delete fundraiser image on removal: ${String(e)}`)
      );
    }
    const photoPaths = ((item.photos ?? []) as { path?: string | null }[])
      .map((p) => p.path)
      .filter((p): p is string => Boolean(p));
    for (const path of photoPaths) {
      await this.supabase.delete(path).catch((e) =>
        this.logger.warn(`Failed to delete fundraiser gallery photo on removal ${path}: ${String(e)}`)
      );
    }
    await this.prisma.fundraiser.update({ where: { id }, data: { deletedAt: new Date() } });
    return { id, deleted: true };
  }

  async approveFundraiser(id: string) {
    await this.findById(id);
    const item = await this.prisma.fundraiser.update({
      where: { id },
      data: { status: FundraiserStatus.ACTIVE, approvedAt: new Date() },
      include: { organizer: { select: ORGANIZER_SELECT } }
    });
    return this.toResponse(item);
  }

  async rejectFundraiser(id: string, reason?: string) {
    await this.findById(id);
    const item = await this.prisma.fundraiser.update({
      where: { id },
      data: { status: FundraiserStatus.REJECTED, rejectionReason: reason ?? null },
      include: { organizer: { select: ORGANIZER_SELECT } }
    });
    return this.toResponse(item);
  }

  async getDonations(fundraiserId: string, page = 1, limit = 20, sortBy: 'recent' | 'top' = 'recent') {
    await this.findById(fundraiserId);
    const skip = (page - 1) * limit;
    const orderBy = sortBy === 'top' ? { amount: 'desc' as const } : { donatedAt: 'desc' as const };

    const [raw, total] = await Promise.all([
      this.prisma.donation.findMany({
        where: { fundraiserId, deletedAt: null },
        orderBy,
        skip,
        take: limit
      }),
      this.prisma.donation.count({ where: { fundraiserId, deletedAt: null } })
    ]);

    const items = raw.map((d) => ({
      id: d.id,
      amount: Number(d.amount),
      message: d.message,
      // Mask anonymous donors — only show "Anonymous"
      displayName: d.isAnonymous ? 'Anonymous' : (d.displayName ?? 'Anonymous'),
      isAnonymous: d.isAnonymous,
      isOffline: d.isOffline,
      donatedAt: d.donatedAt
    }));
    return { items, total, page, limit };
  }

  async getUpdates(fundraiserId: string) {
    await this.findById(fundraiserId);
    const updates = await this.prisma.fundraiserUpdate.findMany({
      where: { fundraiserId },
      orderBy: { createdAt: 'desc' },
      include: { author: { select: ORGANIZER_SELECT } }
    });
    return updates;
  }

  async addUpdate(fundraiserId: string, authorId: string, dto: CreateFundraiserUpdateDto) {
    const fundraiser = await this.findById(fundraiserId);
    // Member route: only the campaign organizer can post updates.
    if (fundraiser.organizerId && fundraiser.organizerId !== authorId) {
      throw new ForbiddenException('Only the organiser can post updates');
    }
    return this.prisma.fundraiserUpdate.create({
      data: { fundraiserId, authorId, title: dto.title, content: dto.content },
      include: { author: { select: ORGANIZER_SELECT } }
    });
  }

  async addUpdateAsAdmin(fundraiserId: string, authorId: string, dto: CreateFundraiserUpdateDto) {
    await this.findById(fundraiserId);
    return this.prisma.fundraiserUpdate.create({
      data: { fundraiserId, authorId, title: dto.title, content: dto.content },
      include: { author: { select: ORGANIZER_SELECT } }
    });
  }

  async recordOfflineDonation(fundraiserId: string, dto: RecordOfflineDonationDto) {
    const fundraiser = await this.findById(fundraiserId);
    if (fundraiser.status !== FundraiserStatus.ACTIVE) {
      throw new ForbiddenException('Cannot record donation on an inactive campaign');
    }
    const prevRaised = Number(fundraiser.raisedAmount);
    await this.recordDonation({
      fundraiserId,
      amount: dto.amount,
      userId: null,
      displayName: dto.displayName ?? null,
      message: dto.message ?? null,
      isAnonymous: false,
      donorEmail: null,
      paymentId: null,
      channel: 'offline',
      providerCheckoutId: null,
      providerPaymentId: null,
      paymentMethod: 'offline',
      currency: 'GBP',
      grossAmount: dto.amount,
      processingFee: 0,
      payerName: dto.displayName ?? null,
      purchasedAt: dto.donatedAt ? new Date(dto.donatedAt) : new Date(),
      notes: 'Offline donation recorded by admin'
    });
    await this.checkMilestones(fundraiserId, prevRaised, prevRaised + dto.amount, Number(fundraiser.targetAmount));
    return { recorded: true };
  }

  async createDonationSession(fundraiserId: string, dto: CreateDonationDto, userId?: string) {
    const fundraiser = await this.prisma.fundraiser.findUnique({
      where: { id: fundraiserId, deletedAt: null, status: FundraiserStatus.ACTIVE }
    });
    if (!fundraiser) throw new NotFoundException('Fundraiser not found or not active');

    const baseUrl = this.configService.get('FRONTEND_URL') ?? 'http://localhost:3000';

    const { provider, method } = await this.payments.resolveCheckoutMethod(dto.paymentMethod);
    if (provider === 'gocardless') {
      return this.createGoCardlessDonationSession(fundraiser, dto, userId, baseUrl, method);
    }

    // Truncate message to 500 chars for Stripe metadata (limit: 500 chars per value)
    const metaMessage = dto.message?.slice(0, 490);
    const checkout = await this.payments.createCheckout({
      amount: Math.round(dto.amount * 100),
      currency: 'gbp',
      includeProcessingFee: dto.addProcessingFee ?? false,
      description: `Donation to ${fundraiser.title}`,
      successUrl: `${baseUrl}/fundraisers/${fundraiserId}?success=1&session_id={CHECKOUT_SESSION_ID}&provider=stripe`,
      cancelUrl: `${baseUrl}/fundraisers/${fundraiserId}?canceled=1`,
      uiMode: 'embedded_page',
      metadata: {
        type: 'donation',
        fundraiserId,
        amount: String(Math.round(dto.amount * 100)),
        ...(userId && { userId }),
        ...(dto.displayName && { displayName: dto.displayName }),
        ...(metaMessage && { message: metaMessage }),
        isAnonymous: String(dto.isAnonymous ?? false)
      }
    });
    return {
      sessionId: checkout.id,
      url: checkout.url,
      provider: checkout.provider,
      clientSecret: checkout.clientSecret
    };
  }

  /**
   * GoCardless variant of createDonationSession. Creates a one-off billing
   * request for the donation (plus the processing fee only when the donor
   * opted in, mirroring the Stripe checkout) and records a pending Payment
   * row keyed by the billing request id, which the fulfilment handler
   * completes in place when the payment confirms.
   */
  private async createGoCardlessDonationSession(
    fundraiser: { id: string; title: string },
    dto: CreateDonationDto,
    userId: string | undefined,
    baseUrl: string,
    method: PaymentMethodOption = 'direct_debit'
  ) {
    const netPence = Math.round(dto.amount * 100);
    const feeResult = dto.addProcessingFee
      ? this.payments.calculateProcessingFee(netPence, 'gocardless')
      : { net: netPence, fee: 0, gross: netPence };
    // Truncate message to keep billing request metadata values compact.
    const metaMessage = dto.message?.slice(0, 490);
    const customerId = userId ? await this.goCardlessService.getOrCreateCustomer(userId) : undefined;
    // An explicit Instant Bank Pay choice maps to faster_payments; otherwise
    // the legacy paymentScheme (default bacs) applies.
    const scheme = method === 'instant_bank_pay' ? 'faster_payments' : (dto.paymentScheme ?? 'bacs');

    // Kept on both the billing request and the pending Payment row so the
    // fulfilment handler can still resolve it locally if the GoCardless API
    // is unreachable when the payment confirms.
    const checkoutMetadata = {
      type: 'donation',
      fundraiserId: fundraiser.id,
      amount: String(netPence),
      netAmount: String(feeResult.net),
      processingFee: String(feeResult.fee),
      grossAmount: String(feeResult.gross),
      ...(userId && { userId }),
      ...(dto.displayName && { displayName: dto.displayName }),
      ...(metaMessage && { message: metaMessage }),
      isAnonymous: String(dto.isAnonymous ?? false)
    };

    const checkout = await this.goCardlessService.createBillingRequestFlow({
      plan: 'one_off',
      amountPence: feeResult.gross,
      description: `Donation to ${fundraiser.title}`,
      scheme,
      metadata: checkoutMetadata,
      redirectUri: `${baseUrl}/fundraisers/${fundraiser.id}?success=1&session_id={BILLING_REQUEST_ID}&provider=gocardless`,
      exitUri: `${baseUrl}/fundraisers/${fundraiser.id}?canceled=1`,
      ...(customerId ? { customerId } : {})
    });

    await this.prisma.payment.create({
      data: {
        userId: userId ?? null,
        paymentChannel: 'gocardless',
        paymentMethod: 'direct_debit',
        paymentStatus: PaymentStatus.PENDING,
        providerCheckoutId: checkout.id,
        currency: 'GBP',
        grossAmount: feeResult.gross / 100,
        processingFee: feeResult.fee / 100,
        netAmount: (feeResult.gross - feeResult.fee) / 100,
        description: `Donation to ${fundraiser.title}`,
        payerName: dto.displayName ?? null,
        purchasedAt: new Date(),
        sourceType: PaymentSourceType.DONATION,
        metadata: checkoutMetadata
      }
    });

    return {
      sessionId: checkout.id,
      url: checkout.url,
      provider: checkout.provider
    };
  }

  async handleCheckoutCompleted(session: Stripe.Checkout.Session) {
    const fundraiserId = session.metadata?.fundraiserId;
    if (!fundraiserId || session.metadata?.type !== 'donation') return;

    // Use the net/advertised amount recorded in metadata rather than the
    // gross Stripe total, which may include the processing fee line item.
    const amount = Number(session.metadata?.netAmount ?? session.amount_total ?? 0) / 100;
    if (amount <= 0) return;

    const userId = session.metadata?.userId ?? null;
    const displayName = session.metadata?.displayName ?? null;
    const message = session.metadata?.message ?? null;
    const isAnonymous = session.metadata?.isAnonymous === 'true';
    const donorEmail = session.customer_details?.email ?? null;

    // payment_intent may be an expanded PaymentIntent object (confirm-session
    // retrieves the session with expand: ['payment_intent']) or just the id
    // (webhook payloads); only the id is storable/queryable.
    const paymentIntentId =
      typeof session.payment_intent === 'string' ? session.payment_intent : (session.payment_intent?.id ?? null);

    await this.recordDonation({
      fundraiserId,
      amount,
      userId,
      displayName,
      message,
      isAnonymous,
      donorEmail,
      paymentId: paymentIntentId,
      channel: 'stripe',
      providerCheckoutId: session.id,
      providerPaymentId: paymentIntentId,
      paymentMethod: session.payment_method_types?.[0],
      currency: session.currency ?? 'gbp',
      grossAmount: amount,
      processingFee: 0,
      payerName: session.customer_details?.name ?? displayName,
      payerPhone: session.customer_details?.phone ?? null,
      purchasedAt: session.created ? new Date(session.created * 1000) : new Date()
    });
  }

  /**
   * Fulfil a confirmed GoCardless donation. Metadata keys mirror the Stripe
   * session conventions: `type: 'donation'`, `fundraiserId`, optional
   * `userId`, `displayName`, `message`, `isAnonymous`, and the pence amounts
   * (`amount` is the net donation, matching the Stripe checkout metadata).
   * When the pending Payment row created at checkout exists it is updated in
   * place instead of creating a duplicate.
   */
  async handleGoCardlessPaymentCompleted(
    payment: GoCardlessPaymentResource,
    metadata: Record<string, string>
  ) {
    if (metadata.type !== 'donation') return null;
    const fundraiserId = metadata.fundraiserId;
    if (!fundraiserId) {
      // Throw rather than silently skip: the processor treats a thrown error as
      // a failed (retryable, visible) webhook instead of a processed one.
      throw new Error(`GoCardless donation payment ${payment.id ?? ''} is missing fundraiserId in its metadata`);
    }

    const billingRequestId = payment.links?.billing_request ?? null;
    const pendingPayment = billingRequestId
      ? await this.prisma.payment.findFirst({
          where: { providerCheckoutId: billingRequestId, paymentChannel: 'gocardless' }
        })
      : null;

    const amount = Number(metadata.amount ?? metadata.netAmount ?? payment.amount ?? 0) / 100;
    if (amount <= 0) {
      throw new Error(
        `GoCardless donation payment ${payment.id ?? ''} for fundraiser ${fundraiserId} has no resolvable amount`
      );
    }

    // recordDonation is idempotent by payment id (donation.paymentId).
    if (payment.id) {
      const existingDonation = await this.prisma.donation.findFirst({
        where: { fundraiserId, paymentId: payment.id }
      });
      if (existingDonation) {
        return { received: true, donationId: existingDonation.id };
      }
    }

    const grossAmount = Number(payment.amount ?? metadata.grossAmount ?? amount * 100) / 100;

    return this.recordDonation({
      fundraiserId,
      amount,
      userId: metadata.userId ?? pendingPayment?.userId ?? null,
      displayName: metadata.displayName ?? null,
      message: metadata.message ?? null,
      isAnonymous: metadata.isAnonymous === 'true',
      donorEmail: pendingPayment?.payerEmail ?? null,
      paymentId: payment.id ?? null,
      channel: 'gocardless',
      providerCheckoutId: billingRequestId,
      providerPaymentId: payment.id ?? null,
      paymentMethod: 'direct_debit',
      currency: payment.currency ?? 'GBP',
      grossAmount,
      processingFee: Math.max(0, grossAmount - amount),
      payerName: metadata.displayName ?? pendingPayment?.payerName ?? null,
      payerPhone: null,
      purchasedAt: payment.created_at ? new Date(payment.created_at) : new Date(),
      notes: 'Donation via GoCardless Direct Debit',
      existingPaymentId: pendingPayment?.id
    });
  }

  async handlePayPalCompleted(payload: any) {
    const metadata = this.payments.extractPayPalMetadata(payload);
    if (!metadata.fundraiserId || metadata.type !== 'donation') return null;

    const amount = Number(metadata.amount || '0') / 100;
    if (amount <= 0) return null;

    const purchaseUnit = payload?.resource?.purchase_units?.[0];
    const payer = payload?.resource?.payer;
    return this.recordDonation({
      fundraiserId: metadata.fundraiserId,
      amount,
      userId: metadata.userId ?? null,
      displayName: metadata.displayName ?? null,
      message: metadata.message ?? null,
      isAnonymous: metadata.isAnonymous === 'true',
      donorEmail: payer?.email_address ?? null,
      paymentId: this.payments.extractPayPalPaymentId(payload),
      channel: 'paypal',
      providerCheckoutId: payload?.resource?.id ?? null,
      providerPaymentId: this.payments.extractPayPalPaymentId(payload),
      paymentMethod: 'paypal',
      currency: purchaseUnit?.amount?.currency_code ?? 'GBP',
      grossAmount: amount,
      processingFee: 0,
      payerName: payer?.name
        ? `${payer.name.given_name ?? ''} ${payer.name.surname ?? ''}`.trim()
        : (metadata.displayName ?? null),
      purchasedAt: payload?.resource?.create_time ? new Date(payload.resource.create_time) : new Date()
    });
  }

  private async recordDonation(
    input: {
      fundraiserId: string;
      amount: number;
      userId: string | null;
      displayName: string | null;
      message: string | null;
      isAnonymous: boolean;
      donorEmail: string | null;
      paymentId: string | null;
      channel?: string;
      providerCheckoutId?: string | null;
      providerPaymentId?: string | null;
      paymentMethod?: string | null;
      currency?: string;
      grossAmount?: number;
      processingFee?: number;
      payerName?: string | null;
      payerPhone?: string | null;
      purchasedAt?: Date;
      notes?: string;
      /** Update this existing (pending) Payment row instead of creating a new one. */
      existingPaymentId?: string;
    }
  ) {
    const {
      fundraiserId,
      amount,
      userId,
      displayName,
      message,
      isAnonymous,
      donorEmail,
      paymentId
    } = input;

    if (paymentId) {
      const existing = await this.prisma.donation.findFirst({
        where: { fundraiserId, paymentId }
      });
      if (existing) {
        this.logger.warn(`Duplicate donation webhook ignored for payment ${paymentId}`);
        return { received: true, donationId: existing.id };
      }
    }

    let prevRaised = 0;
    let targetAmount = 0;
    let donationId: string | null = null;
    const currency = (input.currency ?? 'GBP').toUpperCase();
    const grossAmount = input.grossAmount ?? amount;
    const processingFee = input.processingFee ?? 0;
    const netAmount = grossAmount - processingFee;

    try {
      await this.prisma.$transaction(async (tx) => {
        const donation = await tx.donation.create({
          data: {
            fundraiserId,
            userId,
            amount,
            paymentId,
            displayName,
            message,
            isAnonymous,
            donorEmail,
            isVerified: true
          }
        });
        donationId = donation.id;
        if (input.existingPaymentId) {
          await tx.payment.update({
            where: { id: input.existingPaymentId },
            data: {
              userId,
              donationId: donation.id,
              paymentChannel: input.channel ?? 'stripe',
              paymentMethod: input.paymentMethod ?? null,
              paymentStatus: PaymentStatus.COMPLETED,
              providerPaymentId: input.providerPaymentId ?? paymentId ?? null,
              providerCheckoutId: input.providerCheckoutId ?? null,
              currency,
              grossAmount,
              processingFee,
              netAmount,
              description: `Donation to fundraiser`,
              notes: input.notes ?? message,
              payerName: input.payerName ?? displayName,
              payerEmail: donorEmail,
              payerPhone: input.payerPhone ?? null,
              purchasedAt: input.purchasedAt ?? new Date(),
              sourceType: PaymentSourceType.DONATION,
              sourceId: donation.id
            }
          });
        } else {
          await tx.payment.create({
            data: {
              userId,
              donationId: donation.id,
              paymentChannel: input.channel ?? 'stripe',
              paymentMethod: input.paymentMethod ?? null,
              paymentStatus: PaymentStatus.COMPLETED,
              providerPaymentId: input.providerPaymentId ?? paymentId ?? null,
              providerCheckoutId: input.providerCheckoutId ?? null,
              currency,
              grossAmount,
              processingFee,
              netAmount,
              description: `Donation to fundraiser`,
              notes: input.notes ?? message,
              payerName: input.payerName ?? displayName,
              payerEmail: donorEmail,
              payerPhone: input.payerPhone ?? null,
              purchasedAt: input.purchasedAt ?? new Date(),
              sourceType: PaymentSourceType.DONATION,
              sourceId: donation.id
            }
          });
        }
        const updated = await tx.fundraiser.update({
          where: { id: fundraiserId },
          data: {
            raisedAmount: { increment: amount },
            totalDonors: { increment: 1 }
          }
        });
        prevRaised = Number(updated.raisedAmount) - amount;
        targetAmount = Number(updated.targetAmount);
      });
    } catch (err) {
      // A unique constraint violation on paymentId means another concurrent
      // webhook already recorded this donation; treat it as already processed.
      if (err && typeof err === 'object' && 'code' in err && err.code === 'P2002') {
        this.logger.warn(`Duplicate donation webhook ignored for payment ${paymentId} (race)`);
        return { received: true };
      }
      throw err;
    }

    // Send thank-you email to donor
    if (donorEmail) {
      const fundraiser = await this.prisma.fundraiser.findUnique({ where: { id: fundraiserId }, include: { organizer: { select: { email: true, name: true } } } });
      const donorDisplayName = isAnonymous ? 'Friend' : (displayName ?? 'Friend');
      await this.emailService.sendDonationThankYou(donorEmail, donorDisplayName, fundraiser?.title ?? '', amount);

      // Notify organiser on milestones
      if (fundraiser?.organizer?.email) {
        const newRaised = prevRaised + amount;
        await this.checkMilestones(fundraiserId, prevRaised, newRaised, targetAmount, fundraiser.organizer.email, fundraiser.title, fundraiser.organizer.name);
      }
    }

    return { received: true, donationId };
  }

  async getStats() {
    const [activeCampaigns, pendingCount, totalRaisedResult, totalDonors, recentDonations] = await Promise.all([
      this.prisma.fundraiser.count({ where: { status: FundraiserStatus.ACTIVE, deletedAt: null } }),
      this.prisma.fundraiser.count({ where: { status: FundraiserStatus.PENDING_APPROVAL, deletedAt: null } }),
      this.prisma.fundraiser.aggregate({ where: { deletedAt: null }, _sum: { raisedAmount: true } }),
      this.prisma.donation.count({ where: { deletedAt: null } }),
      this.prisma.donation.findMany({
        where: { deletedAt: null },
        orderBy: { createdAt: 'desc' },
        take: 5
      })
    ]);
    return {
      activeCampaigns,
      pendingCount,
      totalRaised: Number(totalRaisedResult._sum.raisedAmount ?? 0),
      totalDonors,
      recentDonations: recentDonations.map((d) => ({ ...d, amount: Number(d.amount) }))
    };
  }

  private async checkMilestones(
    _fundraiserId: string,
    prevRaised: number,
    newRaised: number,
    targetAmount: number,
    organizerEmail?: string,
    fundraiserTitle?: string,
    organizerName?: string
  ) {
    if (!organizerEmail || targetAmount <= 0) return;
    for (const milestone of MILESTONE_PERCENTAGES) {
      const threshold = (milestone / 100) * targetAmount;
      if (prevRaised < threshold && newRaised >= threshold) {
        await this.emailService.sendMilestoneReached(
          organizerEmail,
          organizerName ?? 'Organiser',
          fundraiserTitle ?? 'your campaign',
          milestone,
          newRaised
        ).catch((e) => this.logger.warn(`Milestone email failed: ${String(e)}`));
      }
    }
  }

  private toResponse(item: any) {
    return {
      ...item,
      targetAmount: Number(item.targetAmount),
      raisedAmount: Number(item.raisedAmount),
      donations: item.donations
        ? item.donations.map((d: any) => ({ ...d, amount: Number(d.amount) }))
        : undefined
    };
  }
}
