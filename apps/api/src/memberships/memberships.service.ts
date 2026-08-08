import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../core/prisma/prisma.service.js';
import { PaymentsService } from '../payments/payments.service.js';
import { EmailService } from '../email/email.service.js';
import { AiService } from '../ai/ai.service.js';
import { MembershipStatus, MembershipType, Membership, Prisma } from '@kentslsc/database';
import { TokenPayload, DependantInput, MembershipFeature } from '@kentslsc/shared';
import { nanoid } from 'nanoid';
import Stripe from 'stripe';
import { generateCardBuffer } from './helpers/card-generator.js';
import { SupabaseStorageService } from '../core/supabase/supabase.service.js';
import type { CreateMembershipTypeDto } from './dto/create-membership-type.dto.js';
import type { UpdateMembershipTypeDto } from './dto/update-membership-type.dto.js';
import type { ApplyMembershipDto } from './dto/apply-membership.dto.js';
import type { StructuredAddressDto } from '../auth/dto/address.dto.js';

interface CreateMembershipData {
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

  async findTypes() {
    const types = await this.prisma.membershipType.findMany({
      where: { deletedAt: null },
      orderBy: { price: 'asc' }
    });
    return types.map((type) => this.serializeMembershipType(type));
  }

  async findTypeById(id: string) {
    const type = await this.prisma.membershipType.findUnique({ where: { id, deletedAt: null } });
    if (!type) throw new NotFoundException('Membership type not found');
    return type;
  }

  async createType(dto: CreateMembershipTypeDto) {
    return this.prisma.membershipType.create({
      data: {
        name: dto.name,
        description: dto.description,
        price: new Prisma.Decimal(dto.price),
        isFree: dto.isFree,
        durationMonths: dto.durationMonths,
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

    const session = await this.paymentsService.createCheckoutSession({
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: {
            currency: 'gbp',
            product_data: {
              name: type.name,
              description: type.description ?? undefined
            },
            unit_amount: Math.round(Number(type.price) * 100)
          },
          quantity: 1
        }
      ],
      mode: 'payment',
      customer_email: email,
      success_url: `${this.frontendUrl}/dashboard?membership=success`,
      cancel_url: `${this.frontendUrl}/membership?canceled=1`,
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

    return { sessionId: session.id, url: session.url, paid: true };
  }

  private async createMembership(data: CreateMembershipData): Promise<Membership> {
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
      startDate: membership.startDate,
      endDate: membership.endDate,
      dependantsCount: dependants.length,
      qrValue: membership.qrCodeValue ?? `${this.frontendUrl}/membership/verify/${membership.membershipId}`
    });

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
      const cardLink = cardUrl ? `<p><a href="${this.apiUrl}${cardUrl}">Download your membership card</a></p>` : '';
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

  async getCardImage(membershipPublicId: string) {
    const membership = await this.prisma.membership.findUnique({
      where: { membershipId: membershipPublicId },
      include: { membershipType: true }
    });

    if (!membership || membership.deletedAt) {
      throw new NotFoundException('Membership not found');
    }

    if (membership.membershipCardUrl?.startsWith('http')) {
      return membership.membershipCardUrl;
    }

    const dependants = (membership.dependantsJson as DependantInput[]) ?? [];
    const user = await this.prisma.user.findUnique({ where: { id: membership.userId }, select: { name: true } });

    const updated = await this.generateAndAttachCard(membership, user?.name ?? 'Member', dependants);

    return updated.membershipCardUrl!;
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
      const md = session.metadata ?? {};

      if (md.source !== 'membership') return null;

      const membershipType = await this.prisma.membershipType.findUnique({
        where: { id: md.membershipTypeId }
      });
      if (!membershipType || membershipType.deletedAt) {
        throw new BadRequestException('Membership type not found');
      }
      if (!md.userId || !md.fullName) {
        throw new BadRequestException('Missing membership metadata');
      }

      let dependants: DependantInput[] = [];
      try {
        dependants = JSON.parse(md.dependants || '[]');
      } catch {
        dependants = [];
      }

      if (dependants.length > 0 && !membershipType.features.includes(MembershipFeature.DEPENDANTS)) {
        throw new BadRequestException('This membership type does not include dependants');
      }

      let address: StructuredAddressDto | undefined;
      try {
        address = md.address ? JSON.parse(md.address) : undefined;
      } catch {
        address = undefined;
      }

      const membership = await this.createMembership({
        userId: md.userId!,
        membershipTypeId: membershipType.id,
        fullName: md.fullName!,
        address,
        phone: md.phone || undefined,
        dependants,
        membershipType,
        overrideEmail: session.customer_email ?? undefined
      });

      return { received: true, membershipId: membership.membershipId };
    }

    return { received: true, membershipId: null };
  }
}
