import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../core/prisma/prisma.service.js';
import { PaymentsService } from '../payments/payments.service.js';
import { EmailService } from '../email/email.service.js';
import { AiService } from '../ai/ai.service.js';
import { MembershipStatus, MembershipType, Membership, Prisma } from '@kentslsc/database';
import { UserRole, TokenPayload, DependantInput } from '@kentslsc/shared';
import { nanoid } from 'nanoid';
import Stripe from 'stripe';
import { generateCardBuffer, saveCard } from './helpers/card-generator.js';
import type { CreateMembershipTypeDto } from './dto/create-membership-type.dto.js';
import type { UpdateMembershipTypeDto } from './dto/update-membership-type.dto.js';
import type { ApplyMembershipDto } from './dto/apply-membership.dto.js';

interface CreateMembershipData {
  userId: string;
  membershipTypeId: string;
  fullName: string;
  address?: string;
  phone?: string;
  dependants?: DependantInput[];
  membershipType: MembershipType;
  overrideEmail?: string;
}

@Injectable()
export class MembershipsService {
  private readonly logger = new Logger(MembershipsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly paymentsService: PaymentsService,
    private readonly emailService: EmailService,
    private readonly aiService: AiService,
    private readonly configService: ConfigService
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

  async findTypes() {
    return this.prisma.membershipType.findMany({
      where: { deletedAt: null },
      orderBy: { price: 'asc' }
    });
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
        benefits: dto.benefits ?? []
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
        benefits: dto.benefits
      }
    });
  }

  async deleteType(id: string) {
    await this.findTypeById(id);
    return this.prisma.membershipType.update({ where: { id }, data: { deletedAt: new Date() } });
  }

  async apply(user: TokenPayload, dto: ApplyMembershipDto) {
    const type = await this.findTypeById(dto.membershipTypeId);

    await this.prisma.user.update({
      where: { id: user.sub },
      data: {
        name: dto.fullName,
        address: dto.address ?? undefined,
        phone: dto.phone ?? undefined
      }
    });

    if (type.isFree || Number(type.price) === 0) {
      const membership = await this.createMembership({
        userId: user.sub,
        membershipTypeId: type.id,
        fullName: dto.fullName,
        address: dto.address,
        phone: dto.phone,
        dependants: dto.dependants ?? [],
        membershipType: type,
        overrideEmail: user.email
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
      customer_email: user.email,
      success_url: `${this.frontendUrl}/dashboard?membership=success`,
      cancel_url: `${this.frontendUrl}/membership?canceled=1`,
      metadata: {
        source: 'membership',
        userId: user.sub,
        membershipTypeId: type.id,
        fullName: dto.fullName,
        address: dto.address ?? '',
        phone: dto.phone ?? '',
        dependants: JSON.stringify(dto.dependants ?? [])
      }
    });

    return { sessionId: session.id, url: session.url, paid: true };
  }

  private async createMembership(data: CreateMembershipData): Promise<Membership> {
    const startDate = new Date();
    const endDate = new Date();
    endDate.setMonth(startDate.getMonth() + data.membershipType.durationMonths);

    const membershipPublicId = this.generateMembershipId();
    const qrValue = `${this.frontendUrl}/membership/verify/${membershipPublicId}`;

    const dependants = data.dependants ?? [];

    let membership = await this.prisma.membership.create({
      data: {
        userId: data.userId,
        membershipTypeId: data.membershipTypeId,
        startDate,
        endDate,
        status: MembershipStatus.ACTIVE,
        dependantsJson: dependants as unknown as Prisma.InputJsonValue,
        membershipId: membershipPublicId,
        qrCodeValue: qrValue,
        membershipCardUrl: undefined
      },
      include: { membershipType: true }
    });

    const cardBuffer = await generateCardBuffer({
      membershipId: membershipPublicId,
      memberName: data.fullName,
      membershipTypeName: data.membershipType.name,
      startDate,
      endDate,
      dependantsCount: dependants.length,
      qrValue
    });

    const cardPath = await saveCard(membershipPublicId, cardBuffer);

    membership = await this.prisma.membership.update({
      where: { id: membership.id },
      data: { membershipCardUrl: cardPath },
      include: { membershipType: true }
    });

    const user = await this.prisma.user.findUnique({
      where: { id: data.userId },
      select: { email: true }
    });

    const email = data.overrideEmail ?? user?.email;
    if (email) {
      try {
        const welcome = await this.aiService.welcome(data.fullName);
        await this.emailService.send({
          to: email,
          subject: 'Welcome to Kent SLSC',
          html: `<p>${welcome}</p><p><a href="${this.apiUrl}${cardPath}">Download your membership card</a></p>`
        });
      } catch (err) {
        this.logger.warn('Failed to send membership email', (err as Error).message);
      }
    }

    return membership;
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

    const dependants = (membership.dependantsJson as { name: string; relationship: string }[]) ?? [];

    return {
      ...membership,
      cardUrl: membership.membershipCardUrl ? `${this.apiUrl}${membership.membershipCardUrl}` : null,
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

    if (membership.membershipCardUrl) {
      return membership.membershipCardUrl;
    }

    const dependants = (membership.dependantsJson as { name: string; relationship: string }[]) ?? [];
    const user = await this.prisma.user.findUnique({ where: { id: membership.userId }, select: { name: true } });

    const buffer = await generateCardBuffer({
      membershipId: membership.membershipId,
      memberName: user?.name ?? 'Member',
      membershipTypeName: membership.membershipType.name,
      startDate: membership.startDate,
      endDate: membership.endDate,
      dependantsCount: dependants.length,
      qrValue: membership.qrCodeValue ?? `${this.frontendUrl}/membership/verify/${membership.membershipId}`
    });

    const cardPath = await saveCard(membership.membershipId, buffer);

    await this.prisma.membership.update({
      where: { id: membership.id },
      data: { membershipCardUrl: cardPath }
    });

    return cardPath;
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

    const dependants = (membership.dependantsJson as { name: string; relationship: string }[]) ?? [];
    const user = await this.prisma.user.findUnique({ where: { id: membership.userId }, select: { name: true } });

    const buffer = await generateCardBuffer({
      membershipId: membership.membershipId,
      memberName: user?.name ?? 'Member',
      membershipTypeName: membership.membershipType.name,
      startDate: membership.startDate,
      endDate: membership.endDate,
      dependantsCount: dependants.length,
      qrValue: membership.qrCodeValue ?? `${this.frontendUrl}/membership/verify/${membership.membershipId}`
    });

    const cardPath = await saveCard(membership.membershipId, buffer);

    return this.prisma.membership.update({
      where: { id: membership.id },
      data: { membershipCardUrl: cardPath },
      include: { membershipType: true }
    });
  }

  async updateStatus(id: string, status: MembershipStatus) {
    const membership = await this.prisma.membership.findFirst({
      where: { id, deletedAt: null },
      include: { membershipType: true }
    });
    if (!membership) throw new NotFoundException('Membership not found');

    const data: Prisma.MembershipUpdateInput = { status };
    if (status === MembershipStatus.ACTIVE) {
      const startDate = membership.startDate ?? new Date();
      const endDate = new Date(startDate);
      endDate.setMonth(startDate.getMonth() + membership.membershipType.durationMonths);
      data.startDate = startDate;
      data.endDate = endDate;
    }

    return this.prisma.membership.update({
      where: { id },
      data,
      include: { membershipType: true, user: { select: { id: true, name: true, email: true } } }
    });
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

      const membership = await this.createMembership({
        userId: md.userId!,
        membershipTypeId: membershipType.id,
        fullName: md.fullName!,
        address: md.address || undefined,
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
