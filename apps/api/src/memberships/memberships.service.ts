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
      dependants
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
      const membership = await this.createMembership({
        userId,
        membershipTypeId: type.id,
        fullName: dto.fullName,
        address: dto.address,
        phone: dto.phone,
        dependants,
        membershipType: type,
        overrideEmail: email
      });
      return { membership, paid: false };
    }

    const checkout = await this.paymentsService.createCheckout({
      amount: Math.round(Number(type.price) * 100),
      currency: 'gbp',
      description: type.name,
      customerEmail: email,
      successUrl: `${this.frontendUrl}/dashboard?membership=success`,
      cancelUrl: `${this.frontendUrl}/membership?canceled=1`,
      metadata: {
        source: 'membership',
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
        membershipCardUrl: undefined
      },
      include: { membershipType: true }
    });

    if (status === MembershipStatus.ACTIVE) {
      membership = await this.generateAndAttachCard(membership, data.fullName, dependants);
      await this.sendWelcomeEmail(data.userId, data.fullName, data.overrideEmail, membership.membershipCardUrl);
    }

    return membership;
  }

  private async generateAndAttachCard(
    membership: Membership & { membershipType: MembershipType },
    memberName: string,
    dependants: DependantInput[]
  ): Promise<Membership & { membershipType: MembershipType }> {
    const cardBuffer = await generateCardBuffer({
      membershipId: membership.membershipId,
      memberName,
      membershipTypeName: membership.membershipType.name,
      isFree: membership.membershipType.isFree,
      startDate: membership.startDate,
      endDate: membership.endDate,
      dependantsCount: dependants.length,
      qrValue: membership.qrCodeValue ?? `${this.frontendUrl}/membership/verify/${membership.membershipId}`
    });

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
    const membership = await this.prisma.membership.findFirst({
      where: { userId, deletedAt: null },
      orderBy: { createdAt: 'desc' },
      include: { membershipType: true }
    });

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
      dependants
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
      const own = await this.prisma.membership.findFirst({
        where: { userId: user.sub, deletedAt: null },
        orderBy: { createdAt: 'desc' },
        select: { membershipId: true, membershipCardUrl: true }
      });
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
    const user = await this.prisma.user.findUnique({ where: { id: membership.userId }, select: { name: true } });

    return this.generateAndAttachCard(membership, user?.name ?? 'Member', dependants);
  }

  async updateStatus(id: string, status: MembershipStatus) {
    const membership = await this.prisma.membership.findFirst({
      where: { id, deletedAt: null },
      include: { membershipType: true, user: { select: { email: true, name: true } } }
    });
    if (!membership) throw new NotFoundException('Membership not found');

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

    if (status === MembershipStatus.ACTIVE && !updated.membershipCardUrl) {
      const dependants = (updated.dependantsJson as DependantInput[]) ?? [];
      const withCard = await this.generateAndAttachCard(updated, updated.user.name, dependants);
      await this.sendWelcomeEmail(updated.userId, updated.user.name, updated.user.email, withCard.membershipCardUrl);
    }

    return updated;
  }

  async handleWebhook(rawBody: Buffer | string, signature: string) {
    const event = await this.paymentsService.constructEvent(rawBody, signature);

    if (event.type === 'checkout.session.completed') {
      const session = event.data.object as Stripe.Checkout.Session;
      return this.handleMembershipCheckoutCompleted(session.metadata ?? {}, session.customer_email ?? undefined);
    }

    return { received: true, membershipId: null };
  }

  async handlePayPalWebhook(payload: Record<string, unknown>) {
    const metadata = this.paymentsService.extractPayPalMetadata(payload);
    if (!metadata.source || metadata.source !== 'membership') {
      return { received: true, membershipId: null };
    }

    const resource = payload?.resource as Record<string, unknown>;
    const payer = resource?.payer as Record<string, unknown>;
    const emailAddress = payer?.email_address as string | undefined;

    return this.handleMembershipCheckoutCompleted(metadata, emailAddress ?? undefined);
  }

  private async handleMembershipCheckoutCompleted(
    metadata: Record<string, string>,
    customerEmail?: string
  ) {
    if (metadata.source !== 'membership') return { received: true, membershipId: null };

    const membershipType = await this.prisma.membershipType.findUnique({
      where: { id: metadata.membershipTypeId }
    });
    if (!membershipType || membershipType.deletedAt) {
      throw new BadRequestException('Membership type not found');
    }
    if (!metadata.userId || !metadata.fullName) {
      throw new BadRequestException('Missing membership metadata');
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

    const membership = await this.createMembership({
      userId: metadata.userId,
      membershipTypeId: membershipType.id,
      fullName: metadata.fullName,
      address,
      phone: metadata.phone || undefined,
      dependants,
      membershipType,
      overrideEmail: customerEmail
    });

    return { received: true, membershipId: membership.membershipId };
  }
}
