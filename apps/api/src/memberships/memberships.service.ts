import { Injectable, NotFoundException, BadRequestException, ForbiddenException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../core/prisma/prisma.service.js';
import { PaymentsService } from '../payments/payments.service.js';
import { EmailService } from '../email/email.service.js';
import { AiService } from '../ai/ai.service.js';
import { MembershipStatus, MembershipType, Membership, Prisma } from '@kentslsc/database';
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

  async findTypes() {
    const types = await this.prisma.membershipType.findMany({
      where: { deletedAt: null },
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

  async findTypeById(id: string) {
    const type = await this.prisma.membershipType.findUnique({ where: { id, deletedAt: null } });
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
    await this.findTypeById(id);
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

  async deleteType(id: string) {
    await this.findTypeById(id);
    return this.prisma.membershipType.update({ where: { id }, data: { deletedAt: new Date() } });
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

    if (type.isFree || Number(type.price) === 0) {
      // Create the new membership before cancelling the old one so a failure
      // after cancellation never leaves the user with no effective membership.
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

    // Paid application: create a pending membership so admins can see the attempt,
    // send payment reminders, and the webhook can activate the exact record.
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
      status: MembershipStatus.PENDING
    });

    const checkout = await this.paymentsService.createCheckout({
      amount: Math.round(Number(type.price) * 100),
      currency: 'gbp',
      description: type.name,
      customerEmail: email,
      successUrl: `${this.frontendUrl}/dashboard?membership=success`,
      cancelUrl: `${this.frontendUrl}/membership?canceled=1`,
      metadata: {
        source: 'membership',
        membershipId: pendingMembership.id,
        userId,
        membershipTypeId: type.id,
        fullName: dto.fullName,
        address: dto.address ? JSON.stringify(dto.address) : '',
        phone: dto.phone ?? '',
        dependants: JSON.stringify(dependants)
      }
    });

    return { sessionId: checkout.id, url: checkout.url, paid: true, provider: checkout.provider };
  }

  async createMembership(data: CreateMembershipData): Promise<Membership> {
    const startDate = new Date();
    const endDate = this.computeEndDate(data.membershipType, startDate);

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
        paymentMethod: data.paymentMethod
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
      paymentMethod: membership.paymentMethod
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

  async handleCheckoutSessionCompleted(session: Stripe.Checkout.Session) {
    return this.handleMembershipCheckoutCompleted(
      session.metadata ?? {},
      'stripe',
      session.customer_email ?? undefined
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
      payload?.resource?.payer?.email_address ?? undefined
    );
  }

  private async handleMembershipCheckoutCompleted(
    metadata: Record<string, string>,
    paymentMethod: string,
    customerEmail?: string
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
        if (existing.status === MembershipStatus.PENDING) {
          await this.cancelPreviousMemberships(metadata.userId, existing.id);
          const activated = await this.updateStatus(existing.id, MembershipStatus.ACTIVE);
          await this.prisma.membership.update({
            where: { id: existing.id },
            data: { paidAt: new Date(), paymentMethod }
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
      paymentMethod
    });

    return { received: true, membershipId: membership.membershipId };
  }
}
