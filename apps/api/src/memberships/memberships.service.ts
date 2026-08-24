import { Injectable, NotFoundException, BadRequestException, ForbiddenException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../core/prisma/prisma.service.js';
import { PaymentsService } from '../payments/payments.service.js';
import { EmailService } from '../email/email.service.js';
import { AiService } from '../ai/ai.service.js';
import {
  MembershipStatus,
  MembershipType,
  Membership,
  MembershipScanResult,
  Prisma,
  PaymentStatus,
  PaymentSourceType
} from '@kentslsc/database';
import { TokenPayload, DependantInput, MembershipFeature, UserRole } from '@kentslsc/shared';
import { nanoid } from 'nanoid';
import Stripe from 'stripe';
import { generateCardBuffer } from './helpers/card-generator.js';
import { SupabaseStorageService } from '../core/supabase/supabase.service.js';
import type { CreateMembershipTypeDto } from './dto/create-membership-type.dto.js';
import type { UpdateMembershipTypeDto } from './dto/update-membership-type.dto.js';
import type { ApplyMembershipDto } from './dto/apply-membership.dto.js';
import type { StructuredAddressDto } from '../auth/dto/address.dto.js';

export interface CreateMembershipData {
  userId: string;
  membershipTypeId: string;
  fullName: string;
  address?: StructuredAddressDto;
  phone?: string;
  dependants?: DependantInput[];
  membershipType: MembershipType;
  overrideEmail?: string;
  status?: MembershipStatus;
  paidAt?: Date;
  paymentMethod?: string;
  startDate?: Date;
  endDate?: Date;
  creditAmountApplied?: number;
  creditMonthsGranted?: number;
  stripeCustomerId?: string;
  stripeSubscriptionId?: string;
  stripePriceId?: string;
  subscriptionStatus?: string;
}

@Injectable()
export class MembershipsService {
  private readonly logger = new Logger(MembershipsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly paymentsService: PaymentsService,
    private readonly emailService: EmailService,
    private readonly aiService: AiService,
    private readonly configService: ConfigService,
    private readonly supabaseStorage: SupabaseStorageService
  ) {}

  private get frontendUrl(): string {
    return this.configService.get<string>('FRONTEND_URL') ?? 'http://localhost:3000';
  }

  private get apiUrl(): string {
    return this.configService.get<string>('API_URL') ?? 'http://localhost:4000';
  }

  private generateMembershipId(): string {
    return `MEM-${nanoid(8).toUpperCase()}`;
  }

  private computeEndDate(membershipType: MembershipType, startDate: Date): Date {
    const endDate = new Date(startDate);
    if (membershipType.isFree) {
      // Free memberships are lifetime; set a far-future expiry.
      endDate.setFullYear(startDate.getFullYear() + 100);
    } else {
      endDate.setMonth(startDate.getMonth() + membershipType.durationMonths);
    }
    return endDate;
  }

  private async resolveMemberName(
    userId: string,
    providedName?: string
  ): Promise<string> {
    const trimmed = providedName?.trim();
    if (trimmed) {
      return trimmed;
    }

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { name: true, firstName: true, lastName: true }
    });

    const builtName = `${user?.firstName ?? ''} ${user?.lastName ?? ''}`.trim();
    return builtName || user?.name?.trim() || 'Member';
  }

  private serializeMembershipType(type: MembershipType) {
    return {
      ...type,
      price: Number(type.price)
    };
  }

  private async assertTypeCapacity(type: MembershipType) {
    if (type.maxIssuances === null || type.maxIssuances === undefined) {
      return;
    }

    const issued = await this.prisma.membership.count({
      where: {
        membershipTypeId: type.id,
        deletedAt: null
      }
    });

    if (issued >= type.maxIssuances) {
      throw new BadRequestException(`${type.name} membership has reached its issuance limit`);
    }
  }

  private async cancelPreviousMemberships(userId: string, excludeId?: string) {
    const where: Prisma.MembershipWhereInput = {
      userId,
      deletedAt: null,
      status: { in: [MembershipStatus.ACTIVE, MembershipStatus.PENDING] }
    };
    if (excludeId) {
      where.id = { not: excludeId };
    }

    await this.prisma.membership.updateMany({
      where,
      data: { status: MembershipStatus.CANCELLED, updatedAt: new Date() }
    });
  }

  private async cancelPreviousPendingMemberships(userId: string, excludeId?: string) {
    const where: Prisma.MembershipWhereInput = {
      userId,
      deletedAt: null,
      status: MembershipStatus.PENDING
    };
    if (excludeId) {
      where.id = { not: excludeId };
    }

    await this.prisma.membership.updateMany({
      where,
      data: { status: MembershipStatus.CANCELLED, updatedAt: new Date() }
    });
  }

  /**
   * Find the user's current effective paid membership. Free and pending
   * memberships are ignored because they carry no refundable monetary value.
   */
  private async findCurrentPaidMembership(userId: string) {
    return this.prisma.membership.findFirst({
      where: {
        userId,
        deletedAt: null,
        status: { in: [MembershipStatus.ACTIVE, MembershipStatus.PENDING] },
        membershipType: { isFree: false }
      },
      orderBy: { createdAt: 'desc' },
      include: { membershipType: true }
    });
  }

  /**
   * Calculate the unused monetary value of an active paid membership.
   * Returns the value in the major currency unit (e.g. GBP).
   */
  private calculateProratedCredit(membership: Membership & { membershipType: MembershipType }): number {
    const now = new Date();
    const start = membership.startDate;
    const end = membership.endDate;

    if (end <= now) {
      return 0;
    }

    const totalMs = end.getTime() - start.getTime();
    const remainingMs = end.getTime() - now.getTime();

    if (totalMs <= 0) {
      return 0;
    }

    const totalPrice = Number(membership.membershipType.price);
    const ratio = Math.max(0, Math.min(1, remainingMs / totalMs));
    return Number((totalPrice * ratio).toFixed(2));
  }

  /**
   * Convert a monetary credit into whole months on the target plan.
   */
  private creditToFreeMonths(credit: number, membershipType: MembershipType): number {
    if (credit <= 0 || membershipType.isFree) {
      return 0;
    }

    const price = Number(membershipType.price);
    if (price <= 0) {
      return 0;
    }

    const monthlyPrice = price / membershipType.durationMonths;
    if (monthlyPrice <= 0) {
      return 0;
    }

    return Math.max(0, Math.floor(credit / monthlyPrice));
  }

  async findTypes(includePaused = false) {
    const where: Prisma.MembershipTypeWhereInput = { deletedAt: null };
    if (!includePaused) {
      where.isPaused = false;
    }

    const types = await this.prisma.membershipType.findMany({
      where,
      orderBy: { price: 'asc' }
    });

    const issuedCounts = await this.prisma.membership.groupBy({
      by: ['membershipTypeId'],
      where: { deletedAt: null },
      _count: { _all: true }
    });
    const countMap = new Map<string, number>(
      issuedCounts.map((row) => [row.membershipTypeId, row._count._all])
    );

    return types.map((type) => {
      const issuedCount = countMap.get(type.id) ?? 0;
      return {
        ...this.serializeMembershipType(type),
        issuedCount,
        hasCapacity: type.maxIssuances === null || type.maxIssuances === undefined
          ? true
          : issuedCount < type.maxIssuances
      };
    });
  }

  async findTypeById(id: string, includePaused = false) {
    const where: Prisma.MembershipTypeWhereUniqueInput & Prisma.MembershipTypeWhereInput = { id, deletedAt: null };
    if (!includePaused) {
      where.isPaused = false;
    }
    const type = await this.prisma.membershipType.findUnique({ where });
    if (!type) throw new NotFoundException('Membership type not found');
    return type;
  }

  async findMembershipById(id: string) {
    const membership = await this.prisma.membership.findUnique({
      where: { id, deletedAt: null },
      include: { membershipType: true, user: { select: { id: true, name: true, email: true } } }
    });
    if (!membership) throw new NotFoundException('Membership not found');

    const dependants = (membership.dependantsJson as DependantInput[]) ?? [];
    return {
      ...membership,
      membershipType: this.serializeMembershipType(membership.membershipType),
      dependants,
      paidAt: membership.paidAt,
      paymentMethod: membership.paymentMethod
    };
  }

  async createType(dto: CreateMembershipTypeDto) {
    return this.prisma.membershipType.create({
      data: {
        name: dto.name,
        description: dto.description,
        price: new Prisma.Decimal(dto.price),
        isFree: dto.isFree,
        durationMonths: dto.durationMonths,
        maxIssuances: dto.maxIssuances,
        benefits: dto.benefits ?? [],
        features: dto.features ?? [],
        autoActivate: dto.autoActivate ?? false
      }
    });
  }

  async updateType(id: string, dto: UpdateMembershipTypeDto) {
    await this.findTypeById(id, true);
    return this.prisma.membershipType.update({
      where: { id },
      data: {
        name: dto.name,
        description: dto.description,
        price: dto.price !== undefined ? new Prisma.Decimal(dto.price) : undefined,
        isFree: dto.isFree,
        durationMonths: dto.durationMonths,
        maxIssuances: dto.maxIssuances,
        benefits: dto.benefits,
        features: dto.features,
        autoActivate: dto.autoActivate
      }
    });
  }

  async pauseType(id: string, targetMembershipTypeId: string) {
    const source = await this.prisma.membershipType.findUnique({
      where: { id, deletedAt: null }
    });
    if (!source) throw new NotFoundException('Membership type not found');
    if (source.isPaused) throw new BadRequestException('Membership type is already paused');

    if (id === targetMembershipTypeId) {
      throw new BadRequestException('Cannot convert a membership type to itself');
    }

    const target = await this.prisma.membershipType.findUnique({
      where: { id: targetMembershipTypeId, deletedAt: null }
    });
    if (!target) throw new NotFoundException('Target membership type not found');
    if (target.isPaused) throw new BadRequestException('Cannot convert members to a paused membership type');

    const sourceCount = await this.prisma.membership.count({
      where: { membershipTypeId: id, deletedAt: null }
    });

    if (target.maxIssuances !== null && target.maxIssuances !== undefined) {
      const targetCount = await this.prisma.membership.count({
        where: { membershipTypeId: target.id, deletedAt: null }
      });
      if (targetCount + sourceCount > target.maxIssuances) {
        throw new BadRequestException(
          `Converting ${sourceCount} member(s) to ${target.name} would exceed its issuance limit of ${target.maxIssuances}`
        );
      }
    }

    const [pausedType, conversionResult] = await this.prisma.$transaction([
      this.prisma.membershipType.update({
        where: { id },
        data: { isPaused: true }
      }),
      this.prisma.membership.updateMany({
        where: { membershipTypeId: id, deletedAt: null },
        data: {
          membershipTypeId: target.id,
          membershipCardUrl: null
        }
      })
    ]);

    return { pausedType, convertedCount: conversionResult.count };
  }

  async resumeType(id: string) {
    const type = await this.prisma.membershipType.findUnique({
      where: { id, deletedAt: null }
    });
    if (!type) throw new NotFoundException('Membership type not found');
    if (!type.isPaused) throw new BadRequestException('Membership type is not paused');

    return this.prisma.membershipType.update({
      where: { id },
      data: { isPaused: false }
    });
  }

  async apply(user: TokenPayload, dto: ApplyMembershipDto) {
    return this.processApplication(user.sub, user.email, dto);
  }

  async processApplication(userId: string, email: string, dto: ApplyMembershipDto) {
    const type = await this.findTypeById(dto.membershipTypeId);

    const dependants = dto.dependants ?? [];
    if (dependants.length > 0 && !type.features.includes(MembershipFeature.DEPENDANTS)) {
      throw new BadRequestException('This membership type does not include dependants');
    }
    await this.assertTypeCapacity(type);

    await this.prisma.user.update({
      where: { id: userId },
      data: {
        name: dto.fullName,
        address: dto.address ? (dto.address as unknown as Prisma.InputJsonValue) : undefined,
        phone: dto.phone ?? undefined
      }
    });

    const currentPaidMembership = await this.findCurrentPaidMembership(userId);

    // Free plans do not carry credit forward; just activate the new plan.
    if (type.isFree || Number(type.price) === 0) {
      // If they are downgrading from a paid subscription, cancel the subscription.
      if (currentPaidMembership?.stripeSubscriptionId) {
        await this.paymentsService.cancelSubscription(currentPaidMembership.stripeSubscriptionId).catch((err) => {
          this.logger.warn(`Failed to cancel subscription ${currentPaidMembership.stripeSubscriptionId}: ${(err as Error).message}`);
        });
      }

      const membership = await this.createMembership({
        userId,
        membershipTypeId: type.id,
        fullName: dto.fullName,
        address: dto.address,
        phone: dto.phone,
        dependants,
        membershipType: type,
        overrideEmail: email,
        status: MembershipStatus.ACTIVE
      });
      await this.cancelPreviousMemberships(userId, membership.id);
      return { membership, paid: false };
    }

    const stripeCustomerId = await this.paymentsService.getOrCreateStripeCustomer(userId, email);
    const synced = await this.paymentsService.syncMembershipTypePrice({
      id: type.id,
      name: type.name,
      price: Number(type.price),
      durationMonths: type.durationMonths
    });

    // Upgrade/downgrade: if they already have an active paid subscription, change the price.
    if (currentPaidMembership?.stripeSubscriptionId && currentPaidMembership?.stripePriceId) {
      const subscription = await this.paymentsService.getSubscription(currentPaidMembership.stripeSubscriptionId);
      const item = subscription.items.data[0];
      if (!item) {
        throw new BadRequestException('Existing subscription has no items');
      }

      await this.paymentsService.updateSubscriptionPrice(
        currentPaidMembership.stripeSubscriptionId,
        item.id,
        synced.priceId,
        'create_prorations'
      );

      // Update the local membership record to reflect the new plan. Stripe webhooks
      // will later adjust the end date when the subscription period changes.
      await this.prisma.membership.update({
        where: { id: currentPaidMembership.id },
        data: {
          membershipTypeId: type.id,
          stripePriceId: synced.priceId,
          dependantsJson: dependants as unknown as Prisma.InputJsonValue
        }
      });

      return {
        membership: await this.findMembershipById(currentPaidMembership.id),
        paid: true,
        upgraded: true,
        subscriptionId: currentPaidMembership.stripeSubscriptionId
      };
    }

    // New paid membership: create pending record and subscription checkout.
    await this.cancelPreviousPendingMemberships(userId);
    const pendingMembership = await this.createMembership({
      userId,
      membershipTypeId: type.id,
      fullName: dto.fullName,
      address: dto.address,
      phone: dto.phone,
      dependants,
      membershipType: type,
      overrideEmail: email,
      status: MembershipStatus.PENDING,
      stripeCustomerId,
      stripePriceId: synced.priceId
    });

    const checkout = await this.paymentsService.createSubscriptionCheckout({
      priceId: synced.priceId,
      customer: stripeCustomerId,
      successUrl: `${this.frontendUrl}/dashboard?membership=success`,
      cancelUrl: `${this.frontendUrl}/membership?canceled=1`,
      uiMode: 'embedded_page',
      metadata: {
        source: 'membership',
        membershipId: pendingMembership.id,
        userId,
        membershipTypeId: type.id,
        fullName: dto.fullName,
        address: dto.address ? JSON.stringify(dto.address) : '',
        phone: dto.phone ?? '',
        dependants: JSON.stringify(dependants),
        amountPence: String(Math.round(Number(type.price) * 100)),
        currency: 'GBP'
      }
    });

    return {
      sessionId: checkout.id,
      url: checkout.url,
      paid: true,
      provider: checkout.provider,
      clientSecret: checkout.clientSecret
    };
  }

  async createMembership(data: CreateMembershipData): Promise<Membership> {
    const startDate = data.startDate ?? new Date();
    const endDate = data.endDate ?? this.computeEndDate(data.membershipType, startDate);

    const membershipPublicId = this.generateMembershipId();
    const qrValue = `${this.frontendUrl}/membership/verify/${membershipPublicId}`;

    const dependants = data.dependants ?? [];
    const status = data.status ?? (data.membershipType.autoActivate ? MembershipStatus.ACTIVE : MembershipStatus.PENDING);

    let membership = await this.prisma.membership.create({
      data: {
        userId: data.userId,
        membershipTypeId: data.membershipTypeId,
        startDate,
        endDate,
        status,
        dependantsJson: dependants as unknown as Prisma.InputJsonValue,
        membershipId: membershipPublicId,
        qrCodeValue: qrValue,
        membershipCardUrl: undefined,
        paidAt: data.paidAt,
        paymentMethod: data.paymentMethod,
        creditAmountApplied:
          data.creditAmountApplied !== undefined ? new Prisma.Decimal(data.creditAmountApplied) : undefined,
        creditMonthsGranted: data.creditMonthsGranted,
        stripeCustomerId: data.stripeCustomerId,
        stripeSubscriptionId: data.stripeSubscriptionId,
        stripePriceId: data.stripePriceId,
        subscriptionStatus: data.subscriptionStatus
      },
      include: { membershipType: true }
    });

    if (status === MembershipStatus.ACTIVE) {
      const memberName = await this.resolveMemberName(data.userId, data.fullName);
      membership = await this.generateAndAttachCard(membership, memberName, dependants);
      await this.sendWelcomeEmail(data.userId, memberName, data.overrideEmail, membership.membershipCardUrl);
    }

    return membership;
  }

  private async generateAndAttachCard(
    membership: Membership & { membershipType: MembershipType },
    memberName: string,
    dependants: DependantInput[]
  ): Promise<Membership & { membershipType: MembershipType }> {
    let cardBuffer: Buffer;
    try {
      cardBuffer = await generateCardBuffer({
        membershipId: membership.membershipId,
        memberName,
        membershipTypeName: membership.membershipType.name,
        isFree: membership.membershipType.isFree,
        startDate: membership.startDate,
        endDate: membership.endDate,
        dependantsCount: dependants.length,
        qrValue: membership.qrCodeValue ?? `${this.frontendUrl}/membership/verify/${membership.membershipId}`
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.warn(
        `Failed to generate membership card for ${membership.membershipId}: ${message}. ` +
          'Membership will be active without a card until generation is fixed.'
      );
      return membership;
    }

    try {
      const { url: cardUrl } = await this.supabaseStorage.uploadBuffer({
        buffer: cardBuffer,
        path: `cards/${membership.membershipId}.png`,
        contentType: 'image/png',
        upsert: true
      });

      return this.prisma.membership.update({
        where: { id: membership.id },
        data: { membershipCardUrl: cardUrl },
        include: { membershipType: true }
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.warn(
        `Failed to upload membership card for ${membership.membershipId}: ${message}. ` +
          'Membership will be active without a card URL until storage is configured.'
      );
      return membership;
    }
  }

  private async sendWelcomeEmail(userId: string, fullName: string, overrideEmail: string | undefined, cardUrl: string | null) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { email: true }
    });

    const email = overrideEmail ?? user?.email;
    if (!email) return;

    try {
      const welcome = await this.aiService.welcome(fullName);
      const cardHref = cardUrl?.startsWith('http') ? cardUrl : `${this.apiUrl}${cardUrl ?? ''}`;
      const cardLink = cardUrl ? `<p><a href="${cardHref}">Download your membership card</a></p>` : '';
      await this.emailService.send({
        to: email,
        subject: 'Welcome to Kent SLSC',
        html: `<p>${welcome}</p>${cardLink}`
      });
    } catch (err) {
      this.logger.warn('Failed to send membership email', (err as Error).message);
    }
  }

  async findMyMembership(userId: string) {
    // Prefer the current effective membership (active or pending). If none
    // exists, fall back to the latest record so the UI can show a status.
    let membership = await this.prisma.membership.findFirst({
      where: {
        userId,
        deletedAt: null,
        status: { in: [MembershipStatus.ACTIVE, MembershipStatus.PENDING] }
      },
      orderBy: { createdAt: 'desc' },
      include: { membershipType: true }
    });

    if (!membership) {
      membership = await this.prisma.membership.findFirst({
        where: { userId, deletedAt: null },
        orderBy: { createdAt: 'desc' },
        include: { membershipType: true }
      });
    }

    if (!membership) {
      return null;
    }

    const dependants = (membership.dependantsJson as DependantInput[]) ?? [];

    return {
      ...membership,
      membershipType: this.serializeMembershipType(membership.membershipType),
      cardUrl: membership.membershipCardUrl
        ? membership.membershipCardUrl.startsWith('http')
          ? membership.membershipCardUrl
          : `${this.apiUrl}${membership.membershipCardUrl}`
        : null,
      qr: membership.qrCodeValue,
      dependantsCount: dependants.length,
      dependants,
      paidAt: membership.paidAt,
      paymentMethod: membership.paymentMethod,
      creditAmountApplied: membership.creditAmountApplied ? Number(membership.creditAmountApplied) : null,
      creditMonthsGranted: membership.creditMonthsGranted,
      stripeSubscriptionId: membership.stripeSubscriptionId
    };
  }

  private async resolveCardImageUrl(
    membershipPublicId: string,
    storedCardUrl?: string | null
  ): Promise<string> {
    if (!storedCardUrl?.startsWith('http')) {
      // Cards are generated when a membership becomes ACTIVE. If a card URL is
      // missing we should not block the request by generating it on-the-fly
      // (that can time out or crash); instead surface it so it can be fixed.
      throw new NotFoundException('Membership card is not available');
    }

    const isPublicBucket = this.supabaseStorage.isPublic;

    if (isPublicBucket !== false) {
      // If the bucket is known to be public (or we haven't checked), prefer the
      // direct public URL. For public buckets this avoids the overhead of
      // signing and works with custom domains.
      return storedCardUrl;
    }

    // The bucket is private. Create a temporary signed URL so the image can be
    // served without making the bucket public.
    const signedUrl = await this.supabaseStorage.getSignedUrlForPublicUrl(storedCardUrl, 86400);
    if (signedUrl) return signedUrl;

    // Fallback to the public URL if signing fails (e.g. custom domain). This
    // will work for public buckets and fail visibly for private ones.
    return storedCardUrl;
  }

  /**
   * Resolve which card the caller is allowed to see.
   *
   * `membershipId` is attacker-controlled, so it must be authorised rather than
   * trusted: without this check any member holding the MEMBER_CARD feature could
   * read any other member's card by guessing or harvesting a membership id.
   */
  async getCardForUser(user: TokenPayload, membershipPublicId?: string) {
    if (!membershipPublicId) {
      // Match the dashboard's definition of "current" membership.
      let own = await this.prisma.membership.findFirst({
        where: {
          userId: user.sub,
          deletedAt: null,
          status: { in: [MembershipStatus.ACTIVE, MembershipStatus.PENDING] }
        },
        orderBy: { createdAt: 'desc' },
        select: { membershipId: true, membershipCardUrl: true }
      });

      if (!own) {
        own = await this.prisma.membership.findFirst({
          where: { userId: user.sub, deletedAt: null },
          orderBy: { createdAt: 'desc' },
          select: { membershipId: true, membershipCardUrl: true }
        });
      }

      if (!own) {
        throw new NotFoundException('No membership found');
      }
      return this.resolveCardImageUrl(own.membershipId, own.membershipCardUrl);
    }

    const membership = await this.prisma.membership.findUnique({
      where: { membershipId: membershipPublicId },
      select: { userId: true, deletedAt: true, membershipCardUrl: true }
    });

    if (!membership || membership.deletedAt) {
      throw new NotFoundException('Membership not found');
    }

    if (membership.userId !== user.sub && user.role !== UserRole.ADMIN) {
      throw new ForbiddenException('You do not have access to this membership card');
    }

    return this.resolveCardImageUrl(membershipPublicId, membership.membershipCardUrl);
  }

  async verifyMembership(membershipPublicId: string) {
    const membership = await this.prisma.membership.findUnique({
      where: { membershipId: membershipPublicId },
      include: { membershipType: true, user: { select: { name: true } } }
    });

    if (!membership || membership.deletedAt) {
      throw new NotFoundException('Membership not found');
    }

    const dependants = (membership.dependantsJson as { name: string; relationship: string }[]) ?? [];

    return {
      valid: membership.status === MembershipStatus.ACTIVE && membership.endDate > new Date(),
      membershipId: membership.membershipId,
      memberName: membership.user.name,
      type: membership.membershipType.name,
      status: membership.status,
      startDate: membership.startDate,
      endDate: membership.endDate,
      dependantsCount: dependants.length
    };
  }

  async regenerateCard(membershipPublicId: string) {
    const membership = await this.prisma.membership.findUnique({
      where: { membershipId: membershipPublicId },
      include: { membershipType: true }
    });

    if (!membership || membership.deletedAt) {
      throw new NotFoundException('Membership not found');
    }

    const dependants = (membership.dependantsJson as DependantInput[]) ?? [];
    const memberName = await this.resolveMemberName(membership.userId);

    return this.generateAndAttachCard(membership, memberName, dependants);
  }

  async regenerateMyCard(userId: string) {
    // Match the dashboard's definition of "current" membership: prefer the
    // active/pending record, then fall back to the latest record of any status.
    let membership = await this.prisma.membership.findFirst({
      where: {
        userId,
        deletedAt: null,
        status: { in: [MembershipStatus.ACTIVE, MembershipStatus.PENDING] }
      },
      orderBy: { createdAt: 'desc' },
      include: { membershipType: true }
    });

    if (!membership) {
      membership = await this.prisma.membership.findFirst({
        where: { userId, deletedAt: null },
        orderBy: { createdAt: 'desc' },
        include: { membershipType: true }
      });
    }

    if (!membership) {
      throw new NotFoundException('No membership found');
    }

    const dependants = (membership.dependantsJson as DependantInput[]) ?? [];
    const memberName = await this.resolveMemberName(userId);

    return this.generateAndAttachCard(membership, memberName, dependants);
  }

  async updateStatus(id: string, status: MembershipStatus) {
    const membership = await this.prisma.membership.findFirst({
      where: { id, deletedAt: null },
      include: { membershipType: true, user: { select: { email: true, name: true } } }
    });
    if (!membership) throw new NotFoundException('Membership not found');

    // When activating a membership, make it the only effective one for the user.
    // This prevents upgrades from leaving stale active/pending records behind.
    if (status === MembershipStatus.ACTIVE) {
      await this.cancelPreviousMemberships(membership.userId, id);
    }

    const data: Prisma.MembershipUpdateInput = { status };
    if (status === MembershipStatus.ACTIVE) {
      const startDate = membership.startDate ?? new Date();
      const endDate = this.computeEndDate(membership.membershipType, startDate);
      data.startDate = startDate;
      data.endDate = endDate;
    }

    const updated = await this.prisma.membership.update({
      where: { id },
      data,
      include: { membershipType: true, user: { select: { id: true, name: true, email: true } } }
    });

    if (status === MembershipStatus.ACTIVE) {
      const dependants = (updated.dependantsJson as DependantInput[]) ?? [];
      const memberName = await this.resolveMemberName(updated.userId, updated.user.name);
      const withCard = await this.generateAndAttachCard(updated, memberName, dependants);
      await this.sendWelcomeEmail(updated.userId, memberName, updated.user.email, withCard.membershipCardUrl);
    }

    return updated;
  }

  async handleWebhook(rawBody: Buffer | string, signature: string) {
    const event = await this.paymentsService.constructEvent(rawBody, signature);

    if (event.type === 'checkout.session.completed') {
      const session = event.data.object as Stripe.Checkout.Session;
      return this.handleCheckoutSessionCompleted(session);
    }

    return { received: true, membershipId: null };
  }

  private async recordMembershipPayment(
    membership: {
      id: string;
      userId: string;
      membershipType: { name: string; price: number | Prisma.Decimal };
      user?: { email?: string; name?: string } | null;
    },
    input: {
      channel: string;
      method?: string | null;
      currency: string;
      amountPence: number;
      providerPaymentId?: string | null;
      providerCheckoutId?: string | null;
      payerEmail?: string | null;
      payerName?: string | null;
      payerPhone?: string | null;
      notes?: string;
    }
  ) {
    const existing = await this.prisma.payment.findFirst({
      where: {
        membershipId: membership.id,
        providerCheckoutId: input.providerCheckoutId ?? undefined
      }
    });
    if (existing) {
      return existing;
    }

    const amount = input.amountPence / 100;

    return this.prisma.payment.create({
      data: {
        userId: membership.userId,
        membershipId: membership.id,
        paymentChannel: input.channel,
        paymentMethod: input.method ?? null,
        paymentStatus: PaymentStatus.COMPLETED,
        providerPaymentId: input.providerPaymentId ?? null,
        providerCheckoutId: input.providerCheckoutId ?? null,
        currency: input.currency.toUpperCase(),
        grossAmount: amount,
        processingFee: 0,
        netAmount: amount,
        description: `Membership: ${membership.membershipType.name}`,
        notes: input.notes ?? null,
        payerName: input.payerName ?? membership.user?.name ?? null,
        payerEmail: input.payerEmail ?? membership.user?.email ?? null,
        payerPhone: input.payerPhone ?? null,
        purchasedAt: new Date(),
        sourceType: PaymentSourceType.MEMBERSHIP,
        sourceId: membership.id
      }
    });
  }

  async handleCheckoutSessionCompleted(session: Stripe.Checkout.Session) {
    const metadata = session.metadata ?? {};
    if (metadata.source !== 'membership') return { received: true, membershipId: null };

    const subscriptionId = typeof session.subscription === 'string'
      ? session.subscription
      : session.subscription?.id;

    const currency = (session.currency ?? 'gbp').toUpperCase();
    const amountPence =
      metadata.amountPence ? Number(metadata.amountPence) : Number(session.amount_total ?? 0);

    if (!subscriptionId) {
      // Fallback for any non-subscription membership checkout (legacy one-off).
      return this.handleMembershipCheckoutCompleted(
        metadata,
        'stripe',
        session.customer_email ?? undefined,
        undefined,
        {
          channel: 'stripe',
          providerCheckoutId: session.id,
          providerPaymentId:
            typeof session.payment_intent === 'string'
              ? session.payment_intent
              : session.payment_intent?.id ?? null,
          amountPence,
          currency,
          payerName: session.customer_details?.name ?? null,
          payerPhone: session.customer_details?.phone ?? null,
          notes: 'Membership payment via Stripe Checkout'
        }
      );
    }

    const stripeSubscription = await this.paymentsService.getSubscription(subscriptionId);
    const stripePriceId = stripeSubscription.items.data[0]?.price.id;
    const customerId = typeof stripeSubscription.customer === 'string'
      ? stripeSubscription.customer
      : stripeSubscription.customer.id;
    const currentPeriodEnd = new Date((stripeSubscription as any).current_period_end * 1000);

    if (metadata.membershipId) {
      const existing = await this.prisma.membership.findUnique({
        where: { id: metadata.membershipId, deletedAt: null },
        include: { membershipType: true, user: { select: { id: true, name: true, email: true } } }
      });

      if (existing && existing.status === MembershipStatus.PENDING) {
        await this.cancelPreviousMemberships(existing.userId, existing.id);
        await this.prisma.membership.update({
          where: { id: existing.id },
          data: {
            status: MembershipStatus.ACTIVE,
            paidAt: new Date(),
            paymentMethod: 'stripe',
            startDate: new Date(),
            endDate: currentPeriodEnd,
            stripeSubscriptionId: subscriptionId,
            stripeCustomerId: customerId,
            stripePriceId: stripePriceId ?? existing.stripePriceId,
            subscriptionStatus: stripeSubscription.status
          }
        });
        const activated = await this.findMembershipById(existing.id);
        await this.recordMembershipPayment(activated, {
          channel: 'stripe',
          method: 'subscription',
          currency,
          amountPence,
          providerCheckoutId: session.id,
          providerPaymentId: subscriptionId,
          payerEmail: session.customer_email ?? session.customer_details?.email ?? null,
          payerName: session.customer_details?.name ?? null,
          payerPhone: session.customer_details?.phone ?? null,
          notes: 'Membership subscription payment via Stripe Checkout'
        });
        return { received: true, membershipId: activated.membershipId };
      }
    }

    // No existing membership record: create one from metadata.
    return this.handleMembershipCheckoutCompleted(
      metadata,
      'stripe',
      session.customer_email ?? undefined,
      { subscriptionId, currentPeriodEnd, stripePriceId, stripeCustomerId: customerId, subscriptionStatus: stripeSubscription.status },
      {
        channel: 'stripe',
        providerCheckoutId: session.id,
        providerPaymentId: subscriptionId,
        amountPence,
        currency,
        payerName: session.customer_details?.name ?? null,
        payerPhone: session.customer_details?.phone ?? null,
        notes: 'Membership subscription payment via Stripe Checkout'
      }
    );
  }

  async handlePayPalWebhook(payload: any) {
    const metadata = this.paymentsService.extractPayPalMetadata(payload);
    if (!metadata.source || metadata.source !== 'membership') {
      return { received: true, membershipId: null };
    }

    return this.handleMembershipCheckoutCompleted(
      metadata,
      'paypal',
      payload?.resource?.payer?.email_address ?? undefined,
      undefined,
      {
        channel: 'paypal',
        providerPaymentId: this.paymentsService.extractPayPalPaymentId(payload),
        providerCheckoutId: payload?.resource?.id ?? null,
        amountPence: metadata.amountPence ? Number(metadata.amountPence) : 0,
        currency: metadata.currency ?? 'GBP',
        payerName: payload?.resource?.payer?.name?.given_name
          ? `${payload?.resource?.payer?.name?.given_name} ${payload?.resource?.payer?.name?.surname ?? ''}`.trim()
          : null,
        notes: 'Membership payment via PayPal'
      }
    );
  }

  private async handleMembershipCheckoutCompleted(
    metadata: Record<string, string>,
    paymentMethod: string,
    customerEmail?: string,
    subscriptionContext?: {
      subscriptionId: string;
      currentPeriodEnd: Date;
      stripePriceId?: string | null;
      stripeCustomerId?: string;
      subscriptionStatus?: string;
    },
    gatewayContext?: {
      channel: string;
      providerCheckoutId?: string | null;
      providerPaymentId?: string | null;
      amountPence?: number;
      currency?: string;
      payerName?: string | null;
      payerPhone?: string | null;
      notes?: string;
    }
  ) {
    if (metadata.source !== 'membership') return { received: true, membershipId: null };

    if (!metadata.userId || !metadata.fullName || !metadata.membershipTypeId) {
      throw new BadRequestException('Missing membership metadata');
    }

    // If a membership record already exists for this checkout, ensure it is active
    // and return it. This makes webhook processing idempotent across retries.
    if (metadata.membershipId) {
      const existing = await this.prisma.membership.findUnique({
        where: { id: metadata.membershipId, deletedAt: null },
        include: { membershipType: true, user: { select: { id: true, name: true, email: true } } }
      });
      if (existing) {
        if (existing.userId !== metadata.userId) {
          this.logger.warn(
            `Membership ${existing.id} belongs to user ${existing.userId} but checkout metadata references ${metadata.userId}. Refusing to activate.`
          );
          throw new BadRequestException('Membership user mismatch');
        }

        if (existing.status === MembershipStatus.PENDING) {
          await this.cancelPreviousMemberships(metadata.userId, existing.id);
          const startDate = new Date();
          const endDate = subscriptionContext?.currentPeriodEnd ?? this.computeEndDate(existing.membershipType, startDate);
          const activated = await this.prisma.membership.update({
            where: { id: existing.id },
            data: {
              status: MembershipStatus.ACTIVE,
              paidAt: new Date(),
              paymentMethod,
              startDate,
              endDate,
              stripeSubscriptionId: subscriptionContext?.subscriptionId ?? existing.stripeSubscriptionId,
              stripeCustomerId: subscriptionContext?.stripeCustomerId ?? existing.stripeCustomerId,
              stripePriceId: subscriptionContext?.stripePriceId ?? existing.stripePriceId
            },
            include: { membershipType: true, user: { select: { id: true, name: true, email: true } } }
          });
          await this.recordMembershipPayment(activated, {
            channel: gatewayContext?.channel ?? paymentMethod,
            method: paymentMethod,
            currency: gatewayContext?.currency ?? metadata.currency ?? 'GBP',
            amountPence:
              gatewayContext?.amountPence ??
              (metadata.amountPence ? Number(metadata.amountPence) : Number(activated.membershipType.price) * 100),
            providerCheckoutId: gatewayContext?.providerCheckoutId,
            providerPaymentId: gatewayContext?.providerPaymentId,
            payerEmail: customerEmail ?? activated.user?.email ?? null,
            payerName: gatewayContext?.payerName ?? activated.user?.name ?? null,
            payerPhone: gatewayContext?.payerPhone ?? null,
            notes: gatewayContext?.notes ?? `Membership payment (${paymentMethod})`
          });
          return { received: true, membershipId: activated.membershipId };
        }
        // Already active (or cancelled/etc.) — do not create a duplicate.
        return { received: true, membershipId: existing.membershipId };
      }
      // Fall through to create a new membership if the referenced one is missing.
    }

    const membershipType = await this.prisma.membershipType.findUnique({
      where: { id: metadata.membershipTypeId }
    });
    if (!membershipType || membershipType.deletedAt) {
      throw new BadRequestException('Membership type not found');
    }

    let dependants: DependantInput[] = [];
    try {
      dependants = JSON.parse(metadata.dependants || '[]');
    } catch {
      dependants = [];
    }

    if (dependants.length > 0 && !membershipType.features.includes(MembershipFeature.DEPENDANTS)) {
      throw new BadRequestException('This membership type does not include dependants');
    }
    await this.assertTypeCapacity(membershipType);

    let address: StructuredAddressDto | undefined;
    try {
      address = metadata.address ? JSON.parse(metadata.address) : undefined;
    } catch {
      address = undefined;
    }

    await this.cancelPreviousMemberships(metadata.userId);

    const startDate = new Date();
    const endDate = subscriptionContext?.currentPeriodEnd ?? this.computeEndDate(membershipType, startDate);

    const membership = await this.createMembership({
      userId: metadata.userId,
      membershipTypeId: membershipType.id,
      fullName: metadata.fullName,
      address,
      phone: metadata.phone || undefined,
      dependants,
      membershipType,
      overrideEmail: customerEmail,
      status: MembershipStatus.ACTIVE,
      paidAt: new Date(),
      paymentMethod,
      startDate,
      endDate,
      stripeSubscriptionId: subscriptionContext?.subscriptionId,
      stripeCustomerId: subscriptionContext?.stripeCustomerId,
      stripePriceId: subscriptionContext?.stripePriceId ?? undefined,
      subscriptionStatus: subscriptionContext?.subscriptionStatus
    });

    const membershipWithType = await this.prisma.membership.findUnique({
      where: { id: membership.id },
      include: { membershipType: true, user: { select: { id: true, name: true, email: true } } }
    });
    if (membershipWithType) {
      await this.recordMembershipPayment(membershipWithType, {
        channel: gatewayContext?.channel ?? paymentMethod,
        method: paymentMethod,
        currency: gatewayContext?.currency ?? metadata.currency ?? 'GBP',
        amountPence:
          gatewayContext?.amountPence ??
          (metadata.amountPence ? Number(metadata.amountPence) : Number(membershipWithType.membershipType.price) * 100),
        providerCheckoutId: gatewayContext?.providerCheckoutId,
        providerPaymentId: gatewayContext?.providerPaymentId,
        payerEmail: customerEmail ?? membershipWithType.user?.email ?? null,
        payerName: gatewayContext?.payerName ?? membershipWithType.user?.name ?? null,
        payerPhone: gatewayContext?.payerPhone ?? null,
        notes: gatewayContext?.notes ?? `Membership payment (${paymentMethod})`
      });
    }

    return { received: true, membershipId: membership.membershipId };
  }

  async createBillingPortalSession(userId: string): Promise<string> {
    const membership = await this.prisma.membership.findFirst({
      where: {
        userId,
        deletedAt: null,
        status: { in: [MembershipStatus.ACTIVE, MembershipStatus.PENDING] },
        stripeCustomerId: { not: null }
      },
      orderBy: { createdAt: 'desc' },
      select: { stripeCustomerId: true }
    });

    if (!membership?.stripeCustomerId) {
      throw new BadRequestException('No active subscription found');
    }

    return this.paymentsService.createBillingPortalSession(
      membership.stripeCustomerId,
      `${this.frontendUrl}/dashboard`
    );
  }

  async handleSubscriptionUpdated(subscription: Stripe.Subscription) {
    const membership = await this.prisma.membership.findFirst({
      where: { stripeSubscriptionId: subscription.id, deletedAt: null }
    });

    if (!membership) {
      return { received: true, membershipId: null };
    }

    const status = subscription.status;
    const membershipStatus =
      status === 'active' || status === 'trialing'
        ? MembershipStatus.ACTIVE
        : status === 'canceled' || status === 'incomplete_expired'
          ? MembershipStatus.CANCELLED
          : membership.status;

    const priceId = subscription.items.data[0]?.price.id;

    // When the price changes, keep the local membership type in sync if possible.
    let membershipTypeId = membership.membershipTypeId;
    if (priceId) {
      const matchingType = await this.prisma.membershipType.findFirst({
        where: { stripePriceId: priceId, deletedAt: null }
      });
      if (matchingType) {
        membershipTypeId = matchingType.id;
      }
    }

    await this.prisma.membership.update({
      where: { id: membership.id },
      data: {
        status: membershipStatus,
        endDate: new Date((subscription as any).current_period_end * 1000),
        stripePriceId: priceId ?? membership.stripePriceId,
        membershipTypeId,
        subscriptionStatus: status
      }
    });

    return { received: true, membershipId: membership.membershipId };
  }

  async handleSubscriptionDeleted(subscription: Stripe.Subscription) {
    const membership = await this.prisma.membership.findFirst({
      where: { stripeSubscriptionId: subscription.id, deletedAt: null }
    });

    if (!membership) {
      return { received: true, membershipId: null };
    }

    await this.prisma.membership.update({
      where: { id: membership.id },
      data: {
        status: MembershipStatus.CANCELLED,
        endDate: new Date(),
        subscriptionStatus: subscription.status
      }
    });

    return { received: true, membershipId: membership.membershipId };
  }

  private extractMembershipId(raw: string): string | null {
    const trimmed = raw.trim();

    // A bare membership id, e.g. MEM-ABC12345.
    if (/^MEM-[A-Z0-9_-]+$/i.test(trimmed)) {
      return trimmed.toUpperCase();
    }

    // The QR code value is a URL like https://.../membership/verify/MEM-ABC12345.
    const match = trimmed.match(/\/membership\/verify\/([^/?#]+)/);
    if (match?.[1]) {
      return match[1].toUpperCase();
    }

    return null;
  }

  async recordScan(qrCodeValue: string, scannedById: string) {
    const membershipPublicId = this.extractMembershipId(qrCodeValue);

    if (!membershipPublicId) {
      const scan = await this.prisma.membershipScan.create({
        data: {
          scannedValue: qrCodeValue,
          result: MembershipScanResult.NOT_FOUND,
          scannedById
        }
      });
      return {
        scan,
        result: MembershipScanResult.NOT_FOUND,
        membership: null
      };
    }

    const membership = await this.prisma.membership.findUnique({
      where: { membershipId: membershipPublicId, deletedAt: null },
      include: {
        membershipType: true,
        user: { select: { name: true, email: true } }
      }
    });

    if (!membership) {
      const scan = await this.prisma.membershipScan.create({
        data: {
          scannedValue: qrCodeValue,
          membershipId: membershipPublicId,
          result: MembershipScanResult.NOT_FOUND,
          scannedById
        }
      });
      return {
        scan,
        result: MembershipScanResult.NOT_FOUND,
        membership: null
      };
    }

    const isExpired = membership.endDate < new Date();
    let result: MembershipScanResult;

    if (isExpired) {
      result = MembershipScanResult.EXPIRED;
    } else if (membership.status === MembershipStatus.CANCELLED) {
      result = MembershipScanResult.CANCELLED;
    } else if (membership.status !== MembershipStatus.ACTIVE) {
      result = MembershipScanResult.INACTIVE;
    } else {
      result = MembershipScanResult.VALID;
    }

    const dependants = (membership.dependantsJson as { name: string; relationship: string }[]) ?? [];

    const scan = await this.prisma.membershipScan.create({
      data: {
        scannedValue: qrCodeValue,
        membershipId: membershipPublicId,
        result,
        memberName: membership.user.name,
        membershipType: membership.membershipType.name,
        scannedById
      }
    });

    return {
      scan,
      result,
      membership: {
        membershipId: membership.membershipId,
        memberName: membership.user.name,
        email: membership.user.email,
        type: membership.membershipType.name,
        status: membership.status,
        startDate: membership.startDate,
        endDate: membership.endDate,
        dependantsCount: dependants.length,
        isExpired
      }
    };
  }

  async listScans(page = 1, limit = 50) {
    const [items, total] = await Promise.all([
      this.prisma.membershipScan.findMany({
        orderBy: { scannedAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        include: {
          scannedBy: { select: { id: true, name: true, email: true } }
        }
      }),
      this.prisma.membershipScan.count()
    ]);

    return {
      items,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit)
    };
  }
}
