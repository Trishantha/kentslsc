import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { TokenPayload } from '@kentslsc/shared';
import { UserRole } from '@kentslsc/shared';
import { PrismaService } from '../core/prisma/prisma.service.js';
import { AiService } from '../ai/ai.service.js';
import { PaymentsService } from '../payments/payments.service.js';
import { EmailService } from '../email/email.service.js';
import { CreateBusinessListingDto } from './dto/create-business.dto.js';
import { UpdateBusinessListingDto } from './dto/update-business.dto.js';
import { CreateJobAdDto } from './dto/create-job.dto.js';
import { UpdateJobAdDto } from './dto/update-job.dto.js';

const PROMOTION_PRICE_PENCE = 2500; // £25

@Injectable()
export class DirectoryService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly aiService: AiService,
    private readonly paymentsService: PaymentsService,
    private readonly emailService: EmailService,
    private readonly configService: ConfigService
  ) {}

  private get frontendUrl(): string {
    return this.configService.get<string>('FRONTEND_URL') ?? 'http://localhost:3000';
  }

  private isOwnerOrAdmin(recordOwnerId: string, user: TokenPayload) {
    return user.role === UserRole.ADMIN || recordOwnerId === user.sub;
  }

  async findBusinesses(search?: string, category?: string, promoted?: boolean) {
    const now = new Date();
    const where: {
      deletedAt: null;
      category?: string;
      isPromoted?: boolean;
      promotedUntil?: { gte: Date };
      OR?: Array<
        | { businessName: { contains: string; mode: 'insensitive' } }
        | { description: { contains: string; mode: 'insensitive' } }
        | { servicesText: { contains: string; mode: 'insensitive' } }
      >;
    } = { deletedAt: null };

    if (category) {
      where.category = category;
    }

    if (promoted) {
      where.isPromoted = true;
      where.promotedUntil = { gte: now };
    }

    if (search) {
      where.OR = [
        { businessName: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
        { servicesText: { contains: search, mode: 'insensitive' } }
      ];
    }

    const listings = await this.prisma.businessListing.findMany({
      where,
      include: {
        _count: { select: { jobAds: { where: { deletedAt: null, isPublished: true } } } }
      },
      orderBy: [{ isPromoted: 'desc' }, { promotedUntil: 'desc' }, { createdAt: 'desc' }]
    });

    return listings.map((listing) => ({
      ...listing,
      isPromoted: listing.isPromoted && !!listing.promotedUntil && listing.promotedUntil > now
    }));
  }

  async findBusinessById(id: string) {
    const listing = await this.prisma.businessListing.findFirst({
      where: { id, deletedAt: null },
      include: {
        jobAds: {
          where: { deletedAt: null },
          orderBy: { createdAt: 'desc' }
        },
        owner: { select: { id: true, name: true, email: true } }
      }
    });
    if (!listing) throw new NotFoundException('Business listing not found');
    return listing;
  }

  async createBusiness(user: TokenPayload, dto: CreateBusinessListingDto) {
    const isAdmin = user.role === UserRole.ADMIN;
    return this.prisma.businessListing.create({
      data: {
        ownerUserId: user.sub,
        businessName: dto.businessName,
        logoUrl: dto.logoUrl,
        description: dto.description,
        servicesText: dto.servicesText,
        websiteUrl: dto.websiteUrl,
        email: dto.email,
        phone: dto.phone,
        address: dto.address,
        category: dto.category,
        isPaid: isAdmin ? dto.isPaid : false
      }
    });
  }

  async updateBusiness(user: TokenPayload, id: string, dto: UpdateBusinessListingDto) {
    const listing = await this.prisma.businessListing.findFirst({ where: { id, deletedAt: null } });
    if (!listing) throw new NotFoundException('Business listing not found');
    if (!this.isOwnerOrAdmin(listing.ownerUserId, user)) {
      throw new ForbiddenException('You do not have permission to update this listing');
    }

    const isAdmin = user.role === UserRole.ADMIN;
    const updated = await this.prisma.businessListing.update({
      where: { id },
      data: {
        businessName: dto.businessName,
        logoUrl: dto.logoUrl,
        description: dto.description,
        servicesText: dto.servicesText,
        websiteUrl: dto.websiteUrl,
        email: dto.email,
        phone: dto.phone,
        address: dto.address,
        category: dto.category,
        ...(isAdmin && { isPaid: dto.isPaid })
      }
    });

    if (dto.description) {
      this.summariseBusiness(user, id).catch(() => undefined);
    }

    return updated;
  }

  async deleteBusiness(user: TokenPayload, id: string) {
    const listing = await this.prisma.businessListing.findFirst({ where: { id, deletedAt: null } });
    if (!listing) throw new NotFoundException('Business listing not found');
    if (!this.isOwnerOrAdmin(listing.ownerUserId, user)) {
      throw new ForbiddenException('You do not have permission to delete this listing');
    }
    await this.prisma.businessListing.update({ where: { id }, data: { deletedAt: new Date() } });
    return { success: true };
  }

  async summariseBusiness(user: TokenPayload, id: string) {
    const listing = await this.prisma.businessListing.findFirst({ where: { id, deletedAt: null } });
    if (!listing) throw new NotFoundException('Business listing not found');
    if (!this.isOwnerOrAdmin(listing.ownerUserId, user)) {
      throw new ForbiddenException('You do not have permission to summarise this listing');
    }

    const content = [listing.businessName, listing.description, listing.servicesText]
      .filter(Boolean)
      .join('\n\n');

    if (!content.trim()) return { aiSummary: null };

    const summary = await this.aiService.summarise(content, 'business listing');
    await this.prisma.businessListing.update({ where: { id }, data: { description: summary } });
    return { aiSummary: summary };
  }

  async createPromotionCheckout(user: TokenPayload, id: string) {
    const listing = await this.prisma.businessListing.findFirst({ where: { id, deletedAt: null } });
    if (!listing) throw new NotFoundException('Business listing not found');
    if (!this.isOwnerOrAdmin(listing.ownerUserId, user)) {
      throw new ForbiddenException('You do not have permission to promote this listing');
    }

    const frontendUrl = this.configService.get<string>('FRONTEND_URL') ?? 'http://localhost:3000';
    const checkout = await this.paymentsService.createCheckout({
      amount: PROMOTION_PRICE_PENCE,
      currency: 'gbp',
      description: `Promote ${listing.businessName} for 30 days`,
      successUrl: `${frontendUrl}/directory/${id}?promoted=success`,
      cancelUrl: `${frontendUrl}/directory/${id}?promoted=cancel`,
      uiMode: 'embedded',
      metadata: {
        type: 'directory_promotion',
        businessListingId: id
      }
    });

    return {
      sessionId: checkout.id,
      url: checkout.url,
      provider: checkout.provider,
      clientSecret: checkout.clientSecret
    };
  }

  async findJobs(businessListingId?: string) {
    const where: { deletedAt: null; isPublished: boolean; businessListingId?: string } = {
      deletedAt: null,
      isPublished: true
    };
    if (businessListingId) {
      where.businessListingId = businessListingId;
    }

    return this.prisma.jobAd.findMany({
      where,
      include: { businessListing: { select: { id: true, businessName: true, logoUrl: true } } },
      orderBy: { createdAt: 'desc' }
    });
  }

  async createJob(user: TokenPayload, dto: CreateJobAdDto) {
    const listing = await this.prisma.businessListing.findFirst({
      where: { id: dto.businessListingId, deletedAt: null }
    });
    if (!listing) throw new NotFoundException('Business listing not found');
    if (!this.isOwnerOrAdmin(listing.ownerUserId, user)) {
      throw new ForbiddenException('You do not have permission to post jobs for this business');
    }

    const isAdmin = user.role === UserRole.ADMIN;
    return this.prisma.jobAd.create({
      data: {
        businessListingId: dto.businessListingId,
        title: dto.title,
        description: dto.description,
        location: dto.location,
        salaryRange: dto.salaryRange,
        contactEmail: dto.contactEmail,
        closingDate: dto.closingDate,
        isPublished: isAdmin ? dto.isPublished : false
      }
    });
  }

  async updateJob(user: TokenPayload, id: string, dto: UpdateJobAdDto) {
    const job = await this.prisma.jobAd.findFirst({
      where: { id, deletedAt: null },
      include: { businessListing: true }
    });
    if (!job || !job.businessListing) throw new NotFoundException('Job ad not found');
    if (!this.isOwnerOrAdmin(job.businessListing.ownerUserId, user)) {
      throw new ForbiddenException('You do not have permission to update this job ad');
    }

    if (dto.businessListingId) {
      const newListing = await this.prisma.businessListing.findFirst({
        where: { id: dto.businessListingId, deletedAt: null }
      });
      if (!newListing) throw new NotFoundException('Target business listing not found');
      if (!this.isOwnerOrAdmin(newListing.ownerUserId, user)) {
        throw new ForbiddenException('You do not have permission to move this job to that business');
      }
    }

    const isAdmin = user.role === UserRole.ADMIN;
    return this.prisma.jobAd.update({
      where: { id },
      data: {
        businessListingId: dto.businessListingId,
        title: dto.title,
        description: dto.description,
        location: dto.location,
        salaryRange: dto.salaryRange,
        contactEmail: dto.contactEmail,
        closingDate: dto.closingDate,
        ...(isAdmin && { isPublished: dto.isPublished })
      }
    });
  }

  async deleteJob(user: TokenPayload, id: string) {
    const job = await this.prisma.jobAd.findFirst({
      where: { id, deletedAt: null },
      include: { businessListing: true }
    });
    if (!job || !job.businessListing) throw new NotFoundException('Job ad not found');
    if (!this.isOwnerOrAdmin(job.businessListing.ownerUserId, user)) {
      throw new ForbiddenException('You do not have permission to delete this job ad');
    }
    await this.prisma.jobAd.update({ where: { id }, data: { deletedAt: new Date() } });
    return { success: true };
  }

  async createJobPublishCheckout(user: TokenPayload, id: string) {
    const job = await this.prisma.jobAd.findFirst({
      where: { id, deletedAt: null },
      include: { businessListing: true }
    });
    if (!job || !job.businessListing) throw new NotFoundException('Job ad not found');
    if (!this.isOwnerOrAdmin(job.businessListing.ownerUserId, user)) {
      throw new ForbiddenException('You do not have permission to publish this job ad');
    }

    const frontendUrl = this.configService.get<string>('FRONTEND_URL') ?? 'http://localhost:3000';
    const checkout = await this.paymentsService.createCheckout({
      amount: 5000,
      currency: 'gbp',
      description: `Publish job ad: ${job.title}`,
      successUrl: `${frontendUrl}/directory/${job.businessListingId}?jobPublished=success`,
      cancelUrl: `${frontendUrl}/directory/${job.businessListingId}?jobPublished=cancel`,
      uiMode: 'embedded',
      metadata: {
        type: 'job_publish',
        jobAdId: id
      }
    });

    return {
      sessionId: checkout.id,
      url: checkout.url,
      provider: checkout.provider,
      clientSecret: checkout.clientSecret
    };
  }

  async promoteBusinessOffline(id: string) {
    const listing = await this.prisma.businessListing.findFirst({
      where: { id, deletedAt: null }
    });
    if (!listing) throw new NotFoundException('Business listing not found');

    const promotedUntil = new Date();
    promotedUntil.setDate(promotedUntil.getDate() + 30);

    await this.prisma.businessListing.update({
      where: { id },
      data: {
        isPromoted: true,
        promotedUntil,
        promotionPaidAt: new Date(),
        promotionPaymentMethod: 'offline'
      }
    });

    return { received: true, promotedUntil };
  }

  async sendPromotionLink(id: string) {
    const listing = await this.prisma.businessListing.findFirst({
      where: { id, deletedAt: null },
      include: { owner: { select: { id: true, email: true, name: true } } }
    });
    if (!listing) throw new NotFoundException('Business listing not found');

    const stripeCustomerId = await this.paymentsService.getOrCreateStripeCustomer(
      listing.owner.id,
      listing.owner.email
    );

    const checkout = await this.paymentsService.createCheckout({
      amount: PROMOTION_PRICE_PENCE,
      currency: 'gbp',
      description: `Promote ${listing.businessName} for 30 days`,
      customer: stripeCustomerId,
      successUrl: `${this.frontendUrl}/directory/${id}?promoted=success`,
      cancelUrl: `${this.frontendUrl}/directory/${id}?promoted=cancel`,
      metadata: {
        type: 'directory_promotion',
        businessListingId: id
      }
    });

    await this.emailService.sendDirectoryPromotionPaymentLink(
      listing.owner.email,
      listing.businessName,
      checkout.url
    );

    return {
      sessionId: checkout.id,
      url: checkout.url,
      provider: checkout.provider,
      clientSecret: checkout.clientSecret
    };
  }

  async handlePromotionCompleted(metadata: Record<string, string>, paymentMethod?: string) {
    const businessListingId = metadata.businessListingId;
    if (!businessListingId || metadata.type !== 'directory_promotion') return null;

    const promotedUntil = new Date();
    promotedUntil.setDate(promotedUntil.getDate() + 30);

    await this.prisma.businessListing.updateMany({
      where: { id: businessListingId, deletedAt: null },
      data: {
        isPromoted: true,
        promotedUntil,
        promotionPaidAt: paymentMethod ? new Date() : undefined,
        promotionPaymentMethod: paymentMethod ?? undefined
      }
    });

    return { received: true };
  }

  async handleJobPublishCompleted(metadata: Record<string, string>) {
    const jobAdId = metadata.jobAdId;
    if (!jobAdId || metadata.type !== 'job_publish') return null;

    await this.prisma.jobAd.updateMany({
      where: { id: jobAdId, deletedAt: null },
      data: { isPublished: true }
    });

    return { received: true };
  }
}
