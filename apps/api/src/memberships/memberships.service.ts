import { Injectable, NotFoundException, BadRequestException, ForbiddenException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../core/prisma/prisma.service.js';
import { PaymentsService } from '../payments/payments.service.js';
import { RefundsService } from '../payments/refunds.service.js';
import { EmailService } from '../email/email.service.js';
import { AiService } from '../ai/ai.service.js';
import {
  MembershipStatus,
  MembershipType,
  Membership,
  MembershipScanResult,
  Prisma,
  PaymentStatus,
  PaymentSourceType,
  AuthEventType
} from '@kentslsc/database';
import { TokenPayload, DependantInput, UserRole } from '@kentslsc/shared';
import { nanoid } from 'nanoid';
import Stripe from 'stripe';
import { generateCardBuffer } from './helpers/card-generator.js';
import { SupabaseStorageService } from '../core/supabase/supabase.service.js';
import type { CreateMembershipTypeDto } from './dto/create-membership-type.dto.js';
import type { UpdateMembershipTypeDto } from './dto/update-membership-type.dto.js';
import type { ApplyMembershipDto } from './dto/apply-membership.dto.js';
import type { StructuredAddressDto } from '../auth/dto/address.dto.js';
import {
  resolveInvoicePaymentIntentId,
  resolveInvoiceSubscriptionId,
  resolveSubscriptionPeriodEnd
} from '../payments/utils/stripe-compat.js';

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
    private readonly refundsService: RefundsService,
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
      status: {
        in: [
          MembershipStatus.ACTIVE,
          MembershipStatus.PENDING,
          MembershipStatus.AWAITING_APPROVAL,
          MembershipStatus.AWAITING_PAYMENT
        ]
      }
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
      status: {
        in: [
          MembershipStatus.PENDING,
          MembershipStatus.AWAITING_APPROVAL,
          MembershipStatus.AWAITING_PAYMENT
        ]
      }
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
   * Keep the user's system role in sync with their active qualifying memberships.
   * Promotes GUEST → MEMBER while an active membership of a type that grants the
   * member role exists; demotes MEMBER → GUEST when none remain. Never touches
   * ADMIN or BUSINESS_OWNER roles.
   */
  async syncMemberRole(userId: string): Promise<void> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { role: true }
    });
    if (!user) return;

    if (user.role === UserRole.ADMIN || user.role === UserRole.BUSINESS_OWNER) {
      return;
    }

    const now = new Date();
    const qualifyingMembership = await this.prisma.membership.findFirst({
      where: {
        userId,
        deletedAt: null,
        status: MembershipStatus.ACTIVE,
        endDate: { gt: now },
        membershipType: { grantsMemberRole: true }
      }
    });

    const shouldBeMember = Boolean(qualifyingMembership);

    if (shouldBeMember && user.role === UserRole.GUEST) {
      const changed = await this.prisma.user.updateMany({
        where: { id: userId, role: UserRole.GUEST },
        data: { role: UserRole.MEMBER, updatedAt: new Date() }
      });
      if (changed.count === 0) return;
      await this.recordRoleChange(userId, UserRole.GUEST, UserRole.MEMBER);
      this.logger.log(`Promoted user ${userId} to MEMBER`);
    } else if (!shouldBeMember && user.role === UserRole.MEMBER) {
      const changed = await this.prisma.user.updateMany({
        where: { id: userId, role: UserRole.MEMBER },
        data: { role: UserRole.GUEST, updatedAt: new Date() }
      });
      if (changed.count === 0) return;
      await this.revokeAllSessions(userId);
      await this.recordRoleChange(userId, UserRole.MEMBER, UserRole.GUEST);
      this.logger.log(`Demoted user ${userId} to GUEST`);
    }
  }

  private async revokeAllSessions(userId: string): Promise<void> {
    await this.prisma.session.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date(), revokedReason: 'membership_lapsed' }
    });
  }

  private async recordRoleChange(
    userId: string,
    fromRole: UserRole,
    toRole: UserRole
  ): Promise<void> {
    try {
      await this.prisma.authEvent.create({
        data: {
          userId,
          type: AuthEventType.ROLE_CHANGED,
          metadata: { from: fromRole, to: toRole, source: 'membership_sync' }
        }
      });
    } catch (err) {
      this.logger.warn(
        `Failed to record role change event for ${userId}: ${(err as Error).message}`
      );
    }
  }

  /**
   * Find the user's current effective paid membership. Free and pending/awaiting
   * approval memberships are ignored because they carry no refundable monetary value.
   */
  private async findCurrentPaidMembership(userId: string) {
    return this.prisma.membership.findFirst({
      where: {
        userId,
        deletedAt: null,
        status: { in: [MembershipStatus.ACTIVE, MembershipStatus.PENDING, MembershipStatus.AWAITING_APPROVAL] },
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

  /**
   * Derive a simple, member-facing progress stage from the membership's
   * status and payment state so the UI can show a step-by-step tracker.
   */
  computeProgressStage(membership: {
    status: MembershipStatus;
    paidAt: Date | null;
    rejectionReason?: string | null;
    membershipType: { isFree: boolean; price: Prisma.Decimal | number };
  }):
    | 'FORM_SUBMITTED'
    | 'AWAITING_PAYMENT'
    | 'PAYMENT_PROCESSED'
    | 'AWAITING_APPROVAL'
    | 'APPROVED'
    | 'REJECTED' {
    if (membership.status === MembershipStatus.CANCELLED) {
      return 'REJECTED';
    }
    if (membership.status === MembershipStatus.ACTIVE || membership.status === MembershipStatus.EXPIRED) {
      return 'APPROVED';
    }
    if (membership.status === MembershipStatus.AWAITING_PAYMENT) {
      return 'AWAITING_PAYMENT';
    }
    const isFree = membership.membershipType.isFree || Number(membership.membershipType.price) === 0;
    if (isFree) return 'AWAITING_APPROVAL';
    if (!membership.paidAt) return 'FORM_SUBMITTED';
    return 'AWAITING_APPROVAL';
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
      paymentMethod: membership.paymentMethod,
      progressStage: this.computeProgressStage(membership)
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
        autoActivate: dto.autoActivate ?? false,
        grantsMemberRole: dto.grantsMemberRole ?? true
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
        autoActivate: dto.autoActivate,
        grantsMemberRole: dto.grantsMemberRole
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
      await this.syncMemberRole(userId);
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

    // New paid membership: create an awaiting-approval record and stop. The admin
    // must review and approve the application before a payment link is sent;
    // payment and activation then happen automatically via the webhook.
    await this.cancelPreviousPendingMemberships(userId);
    const awaitingMembership = await this.createMembership({
      userId,
      membershipTypeId: type.id,
      fullName: dto.fullName,
      address: dto.address,
      phone: dto.phone,
      dependants,
      membershipType: type,
      overrideEmail: email,
      status: MembershipStatus.AWAITING_APPROVAL,
      stripeCustomerId,
      stripePriceId: synced.priceId
    });

    return {
      membership: awaitingMembership,
      paid: true,
      awaitingApproval: true
    };
  }

  async createMembership(data: CreateMembershipData): Promise<Membership> {
    const startDate = data.startDate ?? new Date();
    const endDate = data.endDate ?? this.computeEndDate(data.membershipType, startDate);

    const membershipPublicId = this.generateMembershipId();
    const qrValue = `${this.frontendUrl}/membership/verify/${membershipPublicId}`;

    const dependants = data.dependants ?? [];
    const status =
      data.status ??
      (data.membershipType.isFree || data.membershipType.autoActivate
        ? MembershipStatus.ACTIVE
        : MembershipStatus.AWAITING_APPROVAL);

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
      await this.syncMemberRole(data.userId);
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
    // Prefer the current effective membership (active, pending, awaiting
    // approval, or awaiting payment). If none exists, fall back to the latest
    // record so the UI can show a status.
    let membership = await this.prisma.membership.findFirst({
      where: {
        userId,
        deletedAt: null,
        status: {
          in: [
            MembershipStatus.ACTIVE,
            MembershipStatus.PENDING,
            MembershipStatus.AWAITING_APPROVAL,
            MembershipStatus.AWAITING_PAYMENT
          ]
        }
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
      stripeSubscriptionId: membership.stripeSubscriptionId,
      rejectionReason: membership.rejectionReason,
      progressStage: this.computeProgressStage(membership)
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
          status: {
            in: [
              MembershipStatus.ACTIVE,
              MembershipStatus.PENDING,
              MembershipStatus.AWAITING_APPROVAL,
              MembershipStatus.AWAITING_PAYMENT
            ]
          }
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

    if (membership.status !== MembershipStatus.ACTIVE) {
      throw new BadRequestException('Membership cards can only be generated for active memberships');
    }

    const dependants = (membership.dependantsJson as DependantInput[]) ?? [];
    const memberName = await this.resolveMemberName(membership.userId);

    return this.generateAndAttachCard(membership, memberName, dependants);
  }

  async regenerateMyCard(userId: string) {
    // Match the dashboard's definition of "current" membership: prefer the
    // active/pending/awaiting record, then fall back to the latest record of any status.
    let membership = await this.prisma.membership.findFirst({
      where: {
        userId,
        deletedAt: null,
        status: { in: [MembershipStatus.ACTIVE, MembershipStatus.PENDING, MembershipStatus.AWAITING_APPROVAL] }
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

    if (membership.status !== MembershipStatus.ACTIVE) {
      throw new BadRequestException('Membership cards can only be generated for active memberships');
    }

    const dependants = (membership.dependantsJson as DependantInput[]) ?? [];
    const memberName = await this.resolveMemberName(userId);

    return this.generateAndAttachCard(membership, memberName, dependants);
  }

  async updateDependants(membershipId: string, dependants: DependantInput[]) {
    const membership = await this.prisma.membership.findFirst({
      where: { id: membershipId, deletedAt: null },
      include: {
        membershipType: true,
        user: { select: { id: true, name: true, firstName: true, lastName: true, email: true } }
      }
    });
    if (!membership) throw new NotFoundException('Membership not found');

    const updated = await this.prisma.membership.update({
      where: { id: membershipId },
      data: {
        dependantsJson: dependants as unknown as Prisma.InputJsonValue,
        updatedAt: new Date()
      },
      include: {
        membershipType: true,
        user: { select: { id: true, name: true, firstName: true, lastName: true, email: true } }
      }
    });

    if (updated.status === MembershipStatus.ACTIVE) {
      const memberName = await this.resolveMemberName(updated.userId, updated.user.name);
      return this.generateAndAttachCard(updated, memberName, dependants);
    }

    return updated;
  }

  async updateDependantsForUser(userId: string, dependants: DependantInput[]) {
    const membership = await this.prisma.membership.findFirst({
      where: {
        userId,
        deletedAt: null,
        status: { in: [MembershipStatus.ACTIVE, MembershipStatus.PENDING, MembershipStatus.AWAITING_APPROVAL, MembershipStatus.AWAITING_PAYMENT] }
      },
      orderBy: { createdAt: 'desc' },
      select: { id: true }
    });
    if (!membership) throw new NotFoundException('No membership found');
    return this.updateDependants(membership.id, dependants);
  }

  /**
   * Approve a paid membership application and send the member a payment link.
   * The membership moves from AWAITING_APPROVAL to AWAITING_PAYMENT. Payment
   * and final activation are handled automatically by the Stripe webhook.
   */
  async approveAndRequestPayment(id: string) {
    const membership = await this.prisma.membership.findFirst({
      where: { id, deletedAt: null },
      include: { membershipType: true, user: { select: { id: true, email: true, name: true, firstName: true, lastName: true } } }
    });
    if (!membership) throw new NotFoundException('Membership not found');

    if (membership.status !== MembershipStatus.AWAITING_APPROVAL) {
      throw new BadRequestException('Only awaiting-approval memberships can be approved for payment');
    }

    const isPaidType = !membership.membershipType.isFree && Number(membership.membershipType.price) > 0;
    if (!isPaidType) {
      throw new BadRequestException('Free memberships do not require a payment link');
    }

    if (membership.paidAt || membership.stripeSubscriptionId) {
      throw new BadRequestException('This membership has already been paid');
    }

    const fullName = membership.user.name;
    const stripeCustomerId = await this.paymentsService.getOrCreateStripeCustomer(
      membership.userId,
      membership.user.email
    );
    const synced = await this.paymentsService.syncMembershipTypePrice({
      id: membership.membershipType.id,
      name: membership.membershipType.name,
      price: Number(membership.membershipType.price),
      durationMonths: membership.membershipType.durationMonths
    });

    const updated = await this.prisma.membership.update({
      where: { id: membership.id },
      data: {
        status: MembershipStatus.AWAITING_PAYMENT,
        stripeCustomerId,
        stripePriceId: synced.priceId,
        startDate: new Date()
      },
      include: { membershipType: true, user: { select: { id: true, email: true, name: true } } }
    });

    const checkout = await this.paymentsService.createSubscriptionCheckout({
      priceId: synced.priceId,
      customer: stripeCustomerId,
      successUrl: `${this.frontendUrl}/dashboard?membership=success&session_id={CHECKOUT_SESSION_ID}&provider=stripe`,
      cancelUrl: `${this.frontendUrl}/dashboard?membership=canceled`,
      metadata: {
        source: 'membership',
        membershipId: membership.id,
        userId: membership.userId,
        membershipTypeId: membership.membershipType.id,
        fullName,
        address: '',
        phone: '',
        dependants: JSON.stringify((membership.dependantsJson as Array<{ name: string; relationship: string }> | null) ?? [])
      }
    });

    await this.emailService.sendMembershipPaymentLink(
      membership.user.email,
      fullName,
      membership.membershipType.name,
      checkout.url
    );

    return {
      membership: await this.findMembershipById(updated.id),
      url: checkout.url,
      provider: checkout.provider
    };
  }

  async updateStatus(id: string, status: MembershipStatus, confirmManualPayment = false) {
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
      const isPaidType = !membership.membershipType.isFree && Number(membership.membershipType.price) > 0;
      const isAlreadyPaid = Boolean(membership.paidAt || membership.stripeSubscriptionId);

      // Refuse to silently mark a paid membership type as paid just because an
      // admin clicked "Approve". Marking a membership paid when no payment has
      // actually been received leaves no way to tell real payments apart from
      // mistaken approvals, and previously could not be reversed. Require the
      // admin to explicitly confirm they are recording an offline/manual payment.
      if (isPaidType && !isAlreadyPaid && !confirmManualPayment) {
        throw new BadRequestException(
          'This membership has not been paid yet. Confirm that payment was received offline before approving, or send a payment link instead.'
        );
      }

      // If the membership has already been paid (online or offline), preserve the
      // existing billing period. Otherwise, start the clock from activation.
      const startDate = membership.startDate ?? new Date();
      const endDate = isAlreadyPaid
        ? membership.endDate ?? this.computeEndDate(membership.membershipType, startDate)
        : this.computeEndDate(membership.membershipType, startDate);
      data.startDate = startDate;
      data.endDate = endDate;

      if (isPaidType && !isAlreadyPaid && confirmManualPayment) {
        data.paymentMethod = 'manual';
        data.paidAt = new Date();
      }
    } else if (membership.status === MembershipStatus.ACTIVE && membership.paymentMethod === 'manual') {
      // Reverting an activation that was only backed by a manually-confirmed
      // payment (no real gateway payment) should undo that synthetic mark, so
      // an accidental approval can be cleanly reversed.
      const realPayment = await this.prisma.payment.findFirst({
        where: {
          sourceType: PaymentSourceType.MEMBERSHIP,
          sourceId: membership.id,
          paymentStatus: { in: [PaymentStatus.COMPLETED, PaymentStatus.PARTIALLY_REFUNDED] }
        }
      });
      if (!realPayment) {
        data.paidAt = null;
        data.paymentMethod = null;
      }
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

    if (
      status === MembershipStatus.ACTIVE ||
      status === MembershipStatus.CANCELLED ||
      status === MembershipStatus.EXPIRED
    ) {
      await this.syncMemberRole(updated.userId);
    }

    return updated;
  }

  /**
   * Find the default free membership type to fall back to when a paid
   * application is rejected. Prefers an active (not paused, not deleted) free
   * type with the lowest price.
   */
  private async findDefaultFreeMembershipType() {
    return this.prisma.membershipType.findFirst({
      where: { deletedAt: null, isPaused: false, isFree: true },
      orderBy: { price: 'asc' }
    });
  }

  /**
   * Decline a membership application. Any completed payments linked to it are
   * refunded in full, any Stripe subscription is cancelled, and the member is
   * notified by email that their application was not accepted.
   *
   * For paid memberships, the user is automatically given a free membership
   * (if one exists) so they still have access to basic member benefits.
   */
  async rejectMembership(id: string, reason?: string) {
    const membership = await this.prisma.membership.findFirst({
      where: { id, deletedAt: null },
      include: { membershipType: true, user: { select: { id: true, email: true, name: true } } }
    });
    if (!membership) throw new NotFoundException('Membership not found');

    if (membership.status === MembershipStatus.ACTIVE) {
      throw new BadRequestException(
        'This membership is already active. Cancel it instead if it needs to be revoked.'
      );
    }
    if (membership.status === MembershipStatus.CANCELLED) {
      return membership;
    }

    const payments = await this.prisma.payment.findMany({
      where: {
        sourceType: PaymentSourceType.MEMBERSHIP,
        sourceId: membership.id,
        paymentStatus: PaymentStatus.COMPLETED
      }
    });

    let refunded = false;
    for (const payment of payments) {
      try {
        await this.refundsService.refundPayment(payment.id, { reason: reason ?? 'Membership application rejected' });
        refunded = true;
      } catch (err) {
        this.logger.warn(`Failed to refund payment ${payment.id} for rejected membership ${id}: ${(err as Error).message}`);
      }
    }

    if (membership.stripeSubscriptionId) {
      await this.paymentsService.cancelSubscription(membership.stripeSubscriptionId).catch((err) => {
        this.logger.warn(`Failed to cancel subscription ${membership.stripeSubscriptionId}: ${(err as Error).message}`);
      });
    }

    const isPaidType = !membership.membershipType.isFree && Number(membership.membershipType.price) > 0;
    const freeType = isPaidType ? await this.findDefaultFreeMembershipType() : null;

    const [updated] = await this.prisma.$transaction([
      this.prisma.membership.update({
        where: { id },
        data: {
          status: MembershipStatus.CANCELLED,
          rejectionReason: reason ?? null
        },
        include: { membershipType: true, user: { select: { id: true, email: true, name: true } } }
      }),
      ...(freeType
        ? [
            this.prisma.membership.create({
              data: {
                userId: membership.userId,
                membershipTypeId: freeType.id,
                startDate: new Date(),
                endDate: this.computeEndDate(freeType, new Date()),
                status: MembershipStatus.ACTIVE,
                dependantsJson:
                  membership.dependantsJson === null
                    ? Prisma.JsonNull
                    : (membership.dependantsJson as Prisma.InputJsonValue),
                membershipId: this.generateMembershipId(),
                qrCodeValue: `${this.frontendUrl}/membership/verify/${this.generateMembershipId()}`,
                issuedAt: new Date()
              },
              include: { membershipType: true, user: { select: { id: true, email: true, name: true } } }
            })
          ]
        : [])
    ]);

    let freeMembership: typeof updated | undefined;
    if (freeType) {
      const createdFree = (await this.prisma.membership.findFirst({
        where: { userId: membership.userId, deletedAt: null, status: MembershipStatus.ACTIVE, membershipTypeId: freeType.id },
        orderBy: { createdAt: 'desc' },
        include: { membershipType: true, user: { select: { id: true, email: true, name: true } } }
      }))!;
      freeMembership = createdFree;
      const dependants = (createdFree.dependantsJson as DependantInput[]) ?? [];
      const memberName = await this.resolveMemberName(createdFree.userId, createdFree.user.name);
      const withCard = await this.generateAndAttachCard(createdFree, memberName, dependants);
      await this.sendWelcomeEmail(createdFree.userId, memberName, createdFree.user.email, withCard.membershipCardUrl);
    }

    await this.syncMemberRole(membership.userId);

    if (updated.user?.email) {
      if (freeMembership) {
        await this.emailService
          .sendMembershipRejectedToFreeEmail(
            updated.user.email,
            updated.user.name ?? 'Member',
            updated.membershipType.name,
            freeMembership.membershipType.name,
            reason
          )
          .catch((err) => this.logger.warn(`Failed to send rejection email: ${(err as Error).message}`));
      } else {
        await this.emailService
          .sendMembershipRejectedEmail(
            updated.user.email,
            updated.user.name ?? 'Member',
            updated.membershipType.name,
            refunded,
            reason
          )
          .catch((err) => this.logger.warn(`Failed to send rejection email: ${(err as Error).message}`));
      }
    }

    return { rejected: updated, freeMembership };
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
      providerSubscriptionId?: string | null;
      providerCheckoutId?: string | null;
      stripePaymentIntentId?: string | null;
      payerEmail?: string | null;
      payerName?: string | null;
      payerPhone?: string | null;
      notes?: string;
    }
  ) {
    const existing = await this.prisma.payment.findFirst({
      where: {
        OR: [
          { membershipId: membership.id, providerCheckoutId: input.providerCheckoutId ?? undefined },
          ...(input.providerPaymentId ? [{ providerPaymentId: input.providerPaymentId }] : [])
        ]
      }
    });
    if (existing) {
      return existing;
    }

    const amount = input.amountPence / 100;

    let payment;
    try {
      payment = await this.prisma.payment.create({
        data: {
        userId: membership.userId,
        membershipId: membership.id,
        paymentChannel: input.channel,
        paymentMethod: input.method ?? null,
        paymentStatus: PaymentStatus.COMPLETED,
        providerPaymentId: input.providerPaymentId ?? null,
        providerSubscriptionId: input.providerSubscriptionId ?? null,
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
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        const duplicate = await this.prisma.payment.findFirst({
          where: {
            OR: [
              ...(input.providerCheckoutId ? [{ providerCheckoutId: input.providerCheckoutId }] : []),
              ...(input.providerPaymentId ? [{ providerPaymentId: input.providerPaymentId }] : [])
            ]
          }
        });
        if (duplicate) return duplicate;
      }
      throw error;
    }

    // Overwrite the estimated (zero) fee with Stripe's actual fee so the
    // revenue report matches Stripe's payout reporting. This must run whenever
    // we have a PaymentIntent id, regardless of what providerPaymentId was
    // stored (it may be the subscription id or the PaymentIntent id itself).
    if (payment && input.channel === 'stripe' && input.stripePaymentIntentId) {
      await this.paymentsService.syncStripeFeesByPaymentIntent(
        input.stripePaymentIntentId,
        payment.id
      );
    }

    return payment;
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

    let stripeSubscription: Stripe.Subscription | null = null;
    if (subscriptionId) {
      try {
        stripeSubscription = await this.paymentsService.getSubscription(subscriptionId);
      } catch (err) {
        // A failure to read the subscription must never block the activation of
        // a membership Stripe has already collected payment for. Fall back to
        // the non-subscription path so the member is activated, the card is
        // issued and the payment is recorded.
        this.logger.warn(
          `Could not retrieve Stripe subscription ${subscriptionId} for session ${session.id}: ` +
            `${(err as Error).message}. Applying the payment without subscription details.`
        );
      }
    }

    if (!subscriptionId || !stripeSubscription) {
      // Fallback for any non-subscription membership checkout (legacy one-off).
      return this.handleMembershipCheckoutCompleted(
        metadata,
        'stripe',
        session.customer_email ?? undefined,
        subscriptionId ? { subscriptionId } : undefined,
        {
          channel: 'stripe',
          providerCheckoutId: session.id,
          providerPaymentId:
            typeof session.payment_intent === 'string'
              ? session.payment_intent
              : session.payment_intent?.id ?? null,
          stripePaymentIntentId:
            typeof session.payment_intent === 'string'
              ? session.payment_intent
              : session.payment_intent?.id ?? null,
          providerSubscriptionId: subscriptionId ?? null,
          amountPence,
          currency,
          payerName: session.customer_details?.name ?? null,
          payerPhone: session.customer_details?.phone ?? null,
          notes: 'Membership payment via Stripe Checkout'
        }
      );
    }

    const stripePriceId = stripeSubscription.items.data[0]?.price.id;
    const customerId = typeof stripeSubscription.customer === 'string'
      ? stripeSubscription.customer
      : stripeSubscription.customer.id;
    // Stripe moved `current_period_end` onto subscription items in API version
    // 2025-03-31.basil, so read it from there and fall back to the locally
    // computed period when Stripe does not provide a usable value. Without this
    // the update below received an Invalid Date and the whole activation failed,
    // leaving paid members stuck on "Awaiting payment".
    const currentPeriodEnd = resolveSubscriptionPeriodEnd(stripeSubscription);

    if (metadata.membershipId) {
      const existing = await this.prisma.membership.findUnique({
        where: { id: metadata.membershipId, deletedAt: null },
        include: { membershipType: true, user: { select: { id: true, name: true, email: true } } }
      });

      if (existing && existing.status !== MembershipStatus.CANCELLED) {
        // Legacy PENDING records and approved AWAITING_PAYMENT records auto-
        // activate on payment. AWAITING_APPROVAL records still require an admin
        // decision before payment.
        const activate =
          existing.status === MembershipStatus.PENDING || existing.status === MembershipStatus.AWAITING_PAYMENT;
        const wasUnpaid = !existing.paidAt;
        const startDate = activate ? new Date() : existing.startDate;
        const endDate =
          currentPeriodEnd ??
          (activate ? this.computeEndDate(existing.membershipType, startDate ?? new Date()) : existing.endDate);

        const updated = await this.prisma.membership.update({
          where: { id: existing.id },
          data: {
            status: activate ? MembershipStatus.ACTIVE : existing.status,
            paidAt: new Date(),
            paymentMethod: 'stripe',
            startDate,
            endDate,
            stripeSubscriptionId: subscriptionId,
            stripeCustomerId: customerId,
            stripePriceId: stripePriceId ?? existing.stripePriceId,
            subscriptionStatus: stripeSubscription.status
          },
          include: { membershipType: true, user: { select: { id: true, name: true, email: true } } }
        });

        if (activate) {
          const dependants = (updated.dependantsJson as DependantInput[]) ?? [];
          const memberName = await this.resolveMemberName(updated.userId, updated.user.name);
          const withCard = await this.generateAndAttachCard(updated, memberName, dependants);
          await this.sendWelcomeEmail(updated.userId, memberName, updated.user.email, withCard.membershipCardUrl);
        }

        const sessionPaymentIntentId =
          typeof session.payment_intent === 'string'
            ? session.payment_intent
            : session.payment_intent?.id;
        const latestInvoice =
          stripeSubscription.latest_invoice &&
          typeof stripeSubscription.latest_invoice !== 'string'
            ? (stripeSubscription.latest_invoice as Stripe.Invoice)
            : null;
        const invoicePaymentIntentId =
          sessionPaymentIntentId ?? resolveInvoicePaymentIntentId(latestInvoice) ?? undefined;
        await this.recordMembershipPayment(updated, {
          channel: 'stripe',
          method: 'subscription',
          currency,
          amountPence,
          providerCheckoutId: session.id,
          providerPaymentId: invoicePaymentIntentId,
          providerSubscriptionId: subscriptionId,
          stripePaymentIntentId: invoicePaymentIntentId,
          payerEmail: session.customer_email ?? session.customer_details?.email ?? null,
          payerName: session.customer_details?.name ?? null,
          payerPhone: session.customer_details?.phone ?? null,
          notes: 'Membership subscription payment via Stripe Checkout'
        });
        await this.syncMemberRole(existing.userId);
        if (!activate && existing.status === MembershipStatus.AWAITING_APPROVAL && wasUnpaid) {
          await this.notifyPaymentAwaitingApproval(updated);
        }
        return { received: true, membershipId: updated.membershipId };
      }
    }

    // No existing membership record: create one from metadata.
    const subscriptionLatestInvoice =
      stripeSubscription.latest_invoice &&
      typeof stripeSubscription.latest_invoice !== 'string'
        ? (stripeSubscription.latest_invoice as Stripe.Invoice)
        : null;
    const subscriptionPaymentIntentId =
      resolveInvoicePaymentIntentId(subscriptionLatestInvoice) ?? undefined;
    return this.handleMembershipCheckoutCompleted(
      metadata,
      'stripe',
      session.customer_email ?? undefined,
      {
        subscriptionId,
        currentPeriodEnd: currentPeriodEnd ?? undefined,
        stripePriceId,
        stripeCustomerId: customerId,
        subscriptionStatus: stripeSubscription.status
      },
      {
        channel: 'stripe',
        providerCheckoutId: session.id,
        providerPaymentId: subscriptionPaymentIntentId,
        providerSubscriptionId: subscriptionId,
        stripePaymentIntentId: subscriptionPaymentIntentId,
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
      currentPeriodEnd?: Date;
      stripePriceId?: string | null;
      stripeCustomerId?: string;
      subscriptionStatus?: string;
    },
    gatewayContext?: {
      channel: string;
      providerCheckoutId?: string | null;
      providerPaymentId?: string | null;
      providerSubscriptionId?: string | null;
      stripePaymentIntentId?: string | null;
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

    // If a membership record already exists for this checkout, record the
    // payment but keep it awaiting admin approval. Card generation and welcome
    // emails only happen when an admin explicitly activates the membership.
    if (metadata.membershipId) {
      const existing = await this.prisma.membership.findUnique({
        where: { id: metadata.membershipId, deletedAt: null },
        include: { membershipType: true, user: { select: { id: true, name: true, email: true } } }
      });
      if (existing) {
        if (existing.userId !== metadata.userId) {
          this.logger.warn(
            `Membership ${existing.id} belongs to user ${existing.userId} but checkout metadata references ${metadata.userId}. Refusing to record payment.`
          );
          throw new BadRequestException('Membership user mismatch');
        }

        if (existing.status === MembershipStatus.CANCELLED) {
          // Cancelled memberships should not be resurrected by a webhook.
          return { received: true, membershipId: existing.membershipId };
        }

        // Legacy PENDING records and approved AWAITING_PAYMENT records auto-
        // activate on payment. AWAITING_APPROVAL records still require an admin
        // decision before payment.
        const activate =
          existing.status === MembershipStatus.PENDING || existing.status === MembershipStatus.AWAITING_PAYMENT;
        const wasUnpaid = !existing.paidAt;
        const startDate = activate ? new Date() : existing.startDate;
        const endDate =
          subscriptionContext?.currentPeriodEnd ??
          (activate ? this.computeEndDate(existing.membershipType, new Date()) : existing.endDate);

        const updated = await this.prisma.membership.update({
          where: { id: existing.id },
          data: {
            status: activate ? MembershipStatus.ACTIVE : existing.status,
            paidAt: new Date(),
            paymentMethod,
            startDate,
            endDate,
            stripeSubscriptionId: subscriptionContext?.subscriptionId ?? existing.stripeSubscriptionId,
            stripeCustomerId: subscriptionContext?.stripeCustomerId ?? existing.stripeCustomerId,
            stripePriceId: subscriptionContext?.stripePriceId ?? existing.stripePriceId,
            subscriptionStatus:
              subscriptionContext?.subscriptionStatus ?? existing.subscriptionStatus
          },
          include: { membershipType: true, user: { select: { id: true, name: true, email: true } } }
        });

        if (activate) {
          const dependants = (updated.dependantsJson as DependantInput[]) ?? [];
          const memberName = await this.resolveMemberName(updated.userId, updated.user.name);
          const withCard = await this.generateAndAttachCard(updated, memberName, dependants);
          await this.sendWelcomeEmail(updated.userId, memberName, updated.user.email, withCard.membershipCardUrl);
        }

        await this.recordMembershipPayment(updated, {
          channel: gatewayContext?.channel ?? paymentMethod,
          method: paymentMethod,
          currency: gatewayContext?.currency ?? metadata.currency ?? 'GBP',
          amountPence:
            gatewayContext?.amountPence ??
            (metadata.amountPence ? Number(metadata.amountPence) : Number(updated.membershipType.price) * 100),
          providerCheckoutId: gatewayContext?.providerCheckoutId,
          providerPaymentId: gatewayContext?.providerPaymentId,
          providerSubscriptionId: gatewayContext?.providerSubscriptionId,
          stripePaymentIntentId: gatewayContext?.stripePaymentIntentId,
          payerEmail: customerEmail ?? updated.user?.email ?? null,
          payerName: gatewayContext?.payerName ?? updated.user?.name ?? null,
          payerPhone: gatewayContext?.payerPhone ?? null,
          notes: gatewayContext?.notes ?? `Membership payment (${paymentMethod})`
        });
        await this.syncMemberRole(metadata.userId);
        if (!activate && existing.status === MembershipStatus.AWAITING_APPROVAL && wasUnpaid) {
          await this.notifyPaymentAwaitingApproval(updated);
        }
        return { received: true, membershipId: updated.membershipId };
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
      status: MembershipStatus.AWAITING_APPROVAL,
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
        providerSubscriptionId: gatewayContext?.providerSubscriptionId,
        stripePaymentIntentId: gatewayContext?.stripePaymentIntentId,
        payerEmail: customerEmail ?? membershipWithType.user?.email ?? null,
        payerName: gatewayContext?.payerName ?? membershipWithType.user?.name ?? null,
        payerPhone: gatewayContext?.payerPhone ?? null,
        notes: gatewayContext?.notes ?? `Membership payment (${paymentMethod})`
      });
      await this.notifyPaymentAwaitingApproval(membershipWithType);
    }

    return { received: true, membershipId: membership.membershipId };
  }

  /**
   * Payment for a new/renewed application has been recorded but the membership
   * still needs an admin decision. Let the member know their payment went
   * through and nudge an admin to review it.
   */
  private async notifyPaymentAwaitingApproval(membership: {
    id: string;
    membershipType: { name: string };
    user?: { name?: string | null; email?: string | null } | null;
  }): Promise<void> {
    if (membership.user?.email) {
      await this.emailService
        .sendMembershipAwaitingApprovalEmail(
          membership.user.email,
          membership.user.name ?? 'Member',
          membership.membershipType.name
        )
        .catch((err) => this.logger.warn(`Failed to send awaiting-approval email: ${(err as Error).message}`));
    }

    const settings = await this.prisma.siteSettings.findFirst().catch(() => null);
    if (settings?.email) {
      await this.emailService
        .sendMembershipApplicationAdminNotification(
          settings.email,
          membership.user?.name ?? 'A member',
          membership.membershipType.name,
          `${this.frontendUrl}/admin/memberships/${membership.id}/details`
        )
        .catch((err) => this.logger.warn(`Failed to send admin notification email: ${(err as Error).message}`));
    }
  }

  async createBillingPortalSession(userId: string): Promise<string> {
    const membership = await this.prisma.membership.findFirst({
      where: {
        userId,
        deletedAt: null,
        status: {
          in: [
            MembershipStatus.ACTIVE,
            MembershipStatus.PENDING,
            MembershipStatus.AWAITING_APPROVAL,
            MembershipStatus.AWAITING_PAYMENT
          ]
        },
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
      where: { stripeSubscriptionId: subscription.id, deletedAt: null },
      include: { membershipType: true, user: { select: { id: true, name: true, email: true } } }
    });

    if (!membership) {
      return { received: true, membershipId: null };
    }

    const status = subscription.status;
    // Do not auto-activate memberships that are awaiting admin approval. Stripe
    // subscription events only update subscription metadata; activation is a
    // deliberate admin action.
    const membershipStatus =
      membership.status === MembershipStatus.AWAITING_APPROVAL
        ? MembershipStatus.AWAITING_APPROVAL
        : status === 'active' || status === 'trialing'
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

    // The subscription becoming active means Stripe collected the payment, so
    // finish the activation the same way the checkout handler does: mark the
    // membership paid and issue the card.
    const activating =
      membershipStatus === MembershipStatus.ACTIVE &&
      membership.status !== MembershipStatus.ACTIVE;

    const updated = await this.prisma.membership.update({
      where: { id: membership.id },
      data: {
        status: membershipStatus,
        endDate:
          resolveSubscriptionPeriodEnd(subscription) ??
          (activating
            ? this.computeEndDate(membership.membershipType, membership.startDate ?? new Date())
            : membership.endDate),
        ...(activating && !membership.paidAt
          ? { paidAt: new Date(), paymentMethod: membership.paymentMethod ?? 'stripe' }
          : {}),
        stripePriceId: priceId ?? membership.stripePriceId,
        membershipTypeId,
        subscriptionStatus: status
      },
      include: { membershipType: true, user: { select: { id: true, name: true, email: true } } }
    });

    if (activating && !updated.membershipCardUrl) {
      const dependants = (updated.dependantsJson as DependantInput[]) ?? [];
      const memberName = await this.resolveMemberName(updated.userId, updated.user.name);
      const withCard = await this.generateAndAttachCard(updated, memberName, dependants);
      await this.sendWelcomeEmail(updated.userId, memberName, updated.user.email, withCard.membershipCardUrl);
    }

    await this.syncMemberRole(membership.userId);

    return { received: true, membershipId: membership.membershipId };
  }

  /**
   * Apply a paid Stripe subscription to a membership that is still waiting for
   * payment: activate it, mark it paid, record the payment and issue the card.
   *
   * This is the recovery path used when neither the Stripe webhook nor the
   * browser confirmation managed to apply a successful payment.
   */
  async applyPaidSubscription(membershipId: string, subscription: Stripe.Subscription) {
    const membership = await this.prisma.membership.findUnique({
      where: { id: membershipId, deletedAt: null },
      include: { membershipType: true, user: { select: { id: true, name: true, email: true } } }
    });

    if (!membership) return { activated: false };
    if (
      membership.status !== MembershipStatus.AWAITING_PAYMENT &&
      membership.status !== MembershipStatus.PENDING
    ) {
      return { activated: false };
    }

    const customerId =
      typeof subscription.customer === 'string' ? subscription.customer : subscription.customer?.id;
    const priceId = subscription.items.data[0]?.price.id;
    const startDate = membership.startDate ?? new Date();
    const endDate =
      resolveSubscriptionPeriodEnd(subscription) ??
      this.computeEndDate(membership.membershipType, startDate);

    const updated = await this.prisma.membership.update({
      where: { id: membership.id },
      data: {
        status: MembershipStatus.ACTIVE,
        paidAt: membership.paidAt ?? new Date(),
        paymentMethod: membership.paymentMethod ?? 'stripe',
        startDate,
        endDate,
        stripeSubscriptionId: subscription.id,
        stripeCustomerId: customerId ?? membership.stripeCustomerId,
        stripePriceId: priceId ?? membership.stripePriceId,
        subscriptionStatus: subscription.status
      },
      include: { membershipType: true, user: { select: { id: true, name: true, email: true } } }
    });

    if (!updated.membershipCardUrl) {
      const dependants = (updated.dependantsJson as DependantInput[]) ?? [];
      const memberName = await this.resolveMemberName(updated.userId, updated.user.name);
      const withCard = await this.generateAndAttachCard(updated, memberName, dependants);
      await this.sendWelcomeEmail(updated.userId, memberName, updated.user.email, withCard.membershipCardUrl);
    }

    const latestInvoice =
      subscription.latest_invoice && typeof subscription.latest_invoice !== 'string'
        ? (subscription.latest_invoice as Stripe.Invoice)
        : null;
    const paymentIntentId = resolveInvoicePaymentIntentId(latestInvoice) ?? undefined;

    await this.recordMembershipPayment(updated, {
      channel: 'stripe',
      method: 'subscription',
      currency: (latestInvoice?.currency ?? 'gbp').toUpperCase(),
      amountPence:
        latestInvoice?.amount_paid ?? Math.round(Number(updated.membershipType.price) * 100),
      providerCheckoutId: latestInvoice?.id ?? null,
      providerPaymentId: paymentIntentId,
      providerSubscriptionId: subscription.id,
      stripePaymentIntentId: paymentIntentId,
      payerEmail: updated.user?.email ?? null,
      payerName: updated.user?.name ?? null,
      notes: 'Membership subscription payment reconciled from Stripe'
    });

    await this.syncMemberRole(updated.userId);

    this.logger.log(
      `Reconciled Stripe subscription ${subscription.id} onto membership ${updated.membershipId}`
    );

    return { activated: true, membershipId: updated.membershipId };
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

    await this.syncMemberRole(membership.userId);

    return { received: true, membershipId: membership.membershipId };
  }

  async handleInvoicePaid(invoice: Stripe.Invoice) {
    // Stripe moved the subscription reference to `parent.subscription_details`
    // in API version 2025-03-31.basil; the helper also reads the legacy field.
    const subscriptionId = resolveInvoiceSubscriptionId(invoice);

    if (!subscriptionId) {
      return { received: true, membershipId: null };
    }

    const membership = await this.prisma.membership.findFirst({
      where: { stripeSubscriptionId: subscriptionId, deletedAt: null },
      include: { membershipType: true, user: { select: { id: true, name: true, email: true } } }
    });

    if (!membership) {
      return { received: true, membershipId: null };
    }

    const periodEnd = invoice.lines?.data?.[0]?.period?.end;
    const endDate = periodEnd ? new Date(periodEnd * 1000) : membership.endDate;
    const paidAt = invoice.status_transitions?.paid_at
      ? new Date(invoice.status_transitions.paid_at * 1000)
      : new Date();

    const activate = membership.status === MembershipStatus.AWAITING_PAYMENT;

    await this.prisma.membership.update({
      where: { id: membership.id },
      data: {
        status: activate ? MembershipStatus.ACTIVE : membership.status,
        paidAt,
        paymentMethod: 'stripe',
        endDate,
        subscriptionStatus: 'active'
      }
    });

    if (activate) {
      const dependants = (membership.dependantsJson as DependantInput[]) ?? [];
      const memberName = await this.resolveMemberName(membership.userId, membership.user.name);
      const withCard = await this.generateAndAttachCard(membership, memberName, dependants);
      await this.sendWelcomeEmail(membership.userId, memberName, membership.user.email, withCard.membershipCardUrl);
      await this.syncMemberRole(membership.userId);
    }

    const paymentIntentId = resolveInvoicePaymentIntentId(invoice);
    await this.recordMembershipPayment(membership, {
      channel: 'stripe',
      method: 'subscription',
      currency: (invoice.currency ?? 'gbp').toUpperCase(),
      amountPence: invoice.amount_paid ?? invoice.amount_due,
      providerCheckoutId: invoice.id,
      providerPaymentId: paymentIntentId,
      providerSubscriptionId: subscriptionId,
      stripePaymentIntentId: paymentIntentId,
      payerEmail: invoice.customer_email ?? membership.user?.email ?? null,
      payerName: invoice.customer_name ?? membership.user?.name ?? null,
      notes: 'Membership subscription renewal via Stripe invoice'
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
