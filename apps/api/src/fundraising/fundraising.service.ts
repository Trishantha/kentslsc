import {
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type Stripe from 'stripe';
import { PrismaService } from '../core/prisma/prisma.service.js';
import { AiService } from '../ai/ai.service.js';
import { PaymentsService } from '../payments/payments.service.js';
import { EmailService } from '../email/email.service.js';
import { SupabaseStorageService } from '../core/supabase/supabase.service.js';
import { FundraiserStatus } from '@kentslsc/shared';
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
    private readonly supabase: SupabaseStorageService
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
        updates: { orderBy: { createdAt: 'desc' }, include: { author: { select: ORGANIZER_SELECT } } }
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
        aiSummary: null
      },
      include: { organizer: { select: ORGANIZER_SELECT } }
    });

    if (data.description?.trim()) {
      this.refreshAiSummary(item.id, data.description).catch((error) => {
        this.logger.warn(`Failed to generate fundraiser summary: ${(error as Error).message}`);
      });
    }

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
        ...(data.isActive !== undefined && { isActive: data.isActive })
      },
      include: { organizer: { select: ORGANIZER_SELECT } }
    });

    if (data.description !== undefined) {
      this.refreshAiSummary(id, data.description ?? '').catch((error) => {
        this.logger.warn(`Failed to refresh fundraiser summary: ${(error as Error).message}`);
      });
    }

    return this.toResponse(item);
  }

  private async refreshAiSummary(fundraiserId: string, description: string): Promise<void> {
    const summary = description.trim()
      ? await this.ai.summarise(description, 'fundraiser', 200)
      : null;

    await this.prisma.fundraiser.update({
      where: { id: fundraiserId },
      data: { aiSummary: summary }
    });
  }

  async remove(id: string) {
    const item = await this.findById(id);
    if (item.imagePath) {
      await this.supabase.delete(item.imagePath).catch((e) =>
        this.logger.warn(`Failed to delete fundraiser image on removal: ${String(e)}`)
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
    await this.prisma.$transaction(async (tx) => {
      await tx.donation.create({
        data: {
          fundraiserId,
          amount: dto.amount,
          displayName: dto.displayName ?? null,
          message: dto.message ?? null,
          isOffline: true,
          isVerified: true,
          donatedAt: dto.donatedAt ?? new Date()
        }
      });
      await tx.fundraiser.update({
        where: { id: fundraiserId },
        data: {
          raisedAmount: { increment: dto.amount },
          totalDonors: { increment: 1 }
        }
      });
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
    // Truncate message to 500 chars for Stripe metadata (limit: 500 chars per value)
    const metaMessage = dto.message?.slice(0, 490);
    const checkout = await this.payments.createCheckout({
      amount: Math.round(dto.amount * 100),
      currency: 'gbp',
      includeProcessingFee: dto.addProcessingFee ?? false,
      description: `Donation to ${fundraiser.title}`,
      successUrl: `${baseUrl}/fundraisers/${fundraiserId}?success=1`,
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

    await this.recordDonation({
      fundraiserId,
      amount,
      userId,
      displayName,
      message,
      isAnonymous,
      donorEmail,
      paymentId: session.payment_intent as string | null
    });
  }

  async handlePayPalCompleted(payload: any) {
    const metadata = this.payments.extractPayPalMetadata(payload);
    if (!metadata.fundraiserId || metadata.type !== 'donation') return null;

    const amount = Number(metadata.amount || '0') / 100;
    if (amount <= 0) return null;

    return this.recordDonation({
      fundraiserId: metadata.fundraiserId,
      amount,
      userId: metadata.userId ?? null,
      displayName: metadata.displayName ?? null,
      message: metadata.message ?? null,
      isAnonymous: metadata.isAnonymous === 'true',
      donorEmail: payload?.resource?.payer?.email_address ?? null,
      paymentId: this.payments.extractPayPalPaymentId(payload)
    });
  }

  private async recordDonation(input: {
    fundraiserId: string;
    amount: number;
    userId: string | null;
    displayName: string | null;
    message: string | null;
    isAnonymous: boolean;
    donorEmail: string | null;
    paymentId: string | null;
  }) {
    const { fundraiserId, amount, userId, displayName, message, isAnonymous, donorEmail, paymentId } = input;

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

    try {
      await this.prisma.$transaction(async (tx) => {
        await tx.donation.create({
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

    return { received: true };
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
