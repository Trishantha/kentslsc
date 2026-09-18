import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { TokenPayload } from '@kentslsc/shared';
import { UserRole } from '@kentslsc/shared';
import { PrismaService } from '../core/prisma/prisma.service.js';
import { PaymentsService } from '../payments/payments.service.js';
import { GoCardlessService } from '../payments/gocardless.service.js';
import type { GoCardlessPaymentResource } from '../payments/gocardless-webhook.types.js';
import { EmailService } from '../email/email.service.js';
import { CreateBusinessListingDto } from './dto/create-business.dto.js';
import { UpdateBusinessListingDto } from './dto/update-business.dto.js';
import { CreateJobAdDto } from './dto/create-job.dto.js';
import { UpdateJobAdDto } from './dto/update-job.dto.js';
import type { CheckoutPaymentSchemeDto } from './dto/checkout-payment-scheme.dto.js';
import { PaymentStatus, PaymentSourceType } from '@kentslsc/database';

const PROMOTION_PRICE_PENCE = 2500; // £25
const JOB_PUBLISH_PRICE_PENCE = 5000; // £50

@Injectable()
export class DirectoryService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly paymentsService: PaymentsService,
    private readonly emailService: EmailService,
    private readonly configService: ConfigService,
    private readonly goCardlessService: GoCardlessService
  ) {}

  private get frontendUrl(): string {
    return this.configService.get<string>('FRONTEND_URL') ?? 'http://localhost:3000';
  }

  private isOwnerOrAdmin(recordOwnerId: string, user: TokenPayload) {
    return user.role === UserRole.ADMIN || recordOwnerId === user.sub;
  }

  async findBusinesses(search?: string, category?: string, promoted?: boolean, page = 1, limit = 50) {
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
      orderBy: [{ isPromoted: 'desc' }, { promotedUntil: 'desc' }, { createdAt: 'desc' }],
      take: limit,
      skip: (page - 1) * limit
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
        facebook: dto.facebook,
        instagram: dto.instagram,
        twitter: dto.twitter,
        youtube: dto.youtube,
        linkedin: dto.linkedin,
        tiktok: dto.tiktok,
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
        facebook: dto.facebook,
        instagram: dto.instagram,
        twitter: dto.twitter,
        youtube: dto.youtube,
        linkedin: dto.linkedin,
        tiktok: dto.tiktok,
        ...(isAdmin && { isPaid: dto.isPaid })
      }
    });

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

  async createPromotionCheckout(
    user: TokenPayload,
    id: string,
    dto: CheckoutPaymentSchemeDto = {}
  ) {
    const listing = await this.prisma.businessListing.findFirst({ where: { id, deletedAt: null } });
    if (!listing) throw new NotFoundException('Business listing not found');
    if (!this.isOwnerOrAdmin(listing.ownerUserId, user)) {
      throw new ForbiddenException('You do not have permission to promote this listing');
    }

    const frontendUrl = this.configService.get<string>('FRONTEND_URL') ?? 'http://localhost:3000';

    const { provider, method } = await this.paymentsService.resolveCheckoutMethod(dto.paymentMethod);
    if (provider === 'gocardless') {
      const { checkout } = await this.createGoCardlessCheckout({
        amountPence: PROMOTION_PRICE_PENCE,
        description: `Promote ${listing.businessName} for 30 days`,
        metadata: { type: 'directory_promotion', businessListingId: id },
        successUrl: `${frontendUrl}/directory/${id}?promoted=success&session_id={BILLING_REQUEST_ID}&provider=gocardless`,
        cancelUrl: `${frontendUrl}/directory/${id}?promoted=cancel`,
        customerId: await this.goCardlessService.getOrCreateCustomer(user.sub),
        scheme: method === 'instant_bank_pay' ? 'faster_payments' : dto.paymentScheme
      });

      await this.prisma.payment.create({
        data: {
          userId: listing.ownerUserId,
          businessListingId: id,
          paymentChannel: 'gocardless',
          paymentMethod: 'direct_debit',
          paymentStatus: PaymentStatus.PENDING,
          providerCheckoutId: checkout.id,
          currency: 'GBP',
          grossAmount: PROMOTION_PRICE_PENCE / 100,
          processingFee: 0,
          netAmount: PROMOTION_PRICE_PENCE / 100,
          description: `Directory promotion: ${listing.businessName}`,
          purchasedAt: new Date(),
          sourceType: PaymentSourceType.DIRECTORY_PROMOTION,
          sourceId: id
        }
      });

      return {
        sessionId: checkout.id,
        url: checkout.url,
        provider: checkout.provider
      };
    }

    const checkout = await this.paymentsService.createCheckout({
      amount: PROMOTION_PRICE_PENCE,
      currency: 'gbp',
      description: `Promote ${listing.businessName} for 30 days`,
      successUrl: `${frontendUrl}/directory/${id}?promoted=success&session_id={CHECKOUT_SESSION_ID}&provider=stripe`,
      cancelUrl: `${frontendUrl}/directory/${id}?promoted=cancel`,
      uiMode: 'embedded_page',
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

  async createJobPublishCheckout(
    user: TokenPayload,
    id: string,
    dto: CheckoutPaymentSchemeDto = {}
  ) {
    const job = await this.prisma.jobAd.findFirst({
      where: { id, deletedAt: null },
      include: { businessListing: true }
    });
    if (!job || !job.businessListing) throw new NotFoundException('Job ad not found');
    if (!this.isOwnerOrAdmin(job.businessListing.ownerUserId, user)) {
      throw new ForbiddenException('You do not have permission to publish this job ad');
    }

    const frontendUrl = this.configService.get<string>('FRONTEND_URL') ?? 'http://localhost:3000';

    const { provider, method } = await this.paymentsService.resolveCheckoutMethod(dto.paymentMethod);
    if (provider === 'gocardless') {
      const { checkout } = await this.createGoCardlessCheckout({
        amountPence: JOB_PUBLISH_PRICE_PENCE,
        description: `Publish job ad: ${job.title}`,
        metadata: { type: 'job_publish', jobAdId: id },
        successUrl: `${frontendUrl}/directory/${job.businessListingId}?jobPublished=success&session_id={BILLING_REQUEST_ID}&provider=gocardless`,
        cancelUrl: `${frontendUrl}/directory/${job.businessListingId}?jobPublished=cancel`,
        customerId: await this.goCardlessService.getOrCreateCustomer(user.sub),
        scheme: method === 'instant_bank_pay' ? 'faster_payments' : dto.paymentScheme
      });

      await this.prisma.payment.create({
        data: {
          userId: job.businessListing.ownerUserId,
          jobAdId: id,
          paymentChannel: 'gocardless',
          paymentMethod: 'direct_debit',
          paymentStatus: PaymentStatus.PENDING,
          providerCheckoutId: checkout.id,
          currency: 'GBP',
          grossAmount: JOB_PUBLISH_PRICE_PENCE / 100,
          processingFee: 0,
          netAmount: JOB_PUBLISH_PRICE_PENCE / 100,
          description: `Job publish: ${job.title}`,
          purchasedAt: new Date(),
          sourceType: PaymentSourceType.JOB_PUBLISH,
          sourceId: id
        }
      });

      return {
        sessionId: checkout.id,
        url: checkout.url,
        provider: checkout.provider
      };
    }

    const checkout = await this.paymentsService.createCheckout({
      amount: 5000,
      currency: 'gbp',
      description: `Publish job ad: ${job.title}`,
      successUrl: `${frontendUrl}/directory/${job.businessListingId}?jobPublished=success&session_id={CHECKOUT_SESSION_ID}&provider=stripe`,
      cancelUrl: `${frontendUrl}/directory/${job.businessListingId}?jobPublished=cancel`,
      uiMode: 'embedded_page',
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
      where: { id, deletedAt: null },
      include: { owner: { select: { id: true, name: true, email: true, phone: true } } }
    });
    if (!listing) throw new NotFoundException('Business listing not found');

    const promotedUntil = new Date();
    promotedUntil.setDate(promotedUntil.getDate() + 30);

    await this.prisma.$transaction(async (tx) => {
      await tx.businessListing.update({
        where: { id },
        data: {
          isPromoted: true,
          promotedUntil,
          promotionPaidAt: new Date(),
          promotionPaymentMethod: 'offline'
        }
      });
      await tx.payment.create({
        data: {
          userId: listing.owner.id,
          businessListingId: id,
          paymentChannel: 'offline',
          paymentMethod: 'offline',
          paymentStatus: PaymentStatus.COMPLETED,
          currency: 'GBP',
          grossAmount: PROMOTION_PRICE_PENCE / 100,
          processingFee: 0,
          netAmount: PROMOTION_PRICE_PENCE / 100,
          description: `Directory promotion: ${listing.businessName}`,
          notes: 'Offline promotion recorded by admin',
          payerName: listing.owner.name,
          payerEmail: listing.owner.email,
          payerPhone: listing.owner.phone ?? null,
          purchasedAt: new Date(),
          sourceType: PaymentSourceType.DIRECTORY_PROMOTION,
          sourceId: id
        }
      });
    });

    return { received: true, promotedUntil };
  }

  async promoteBusinessFree(id: string) {
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
        promotionPaidAt: null,
        promotionPaymentMethod: 'free'
      }
    });

    return { received: true, promotedUntil };
  }

  async unpromoteBusiness(id: string) {
    const listing = await this.prisma.businessListing.findFirst({
      where: { id, deletedAt: null }
    });
    if (!listing) throw new NotFoundException('Business listing not found');

    await this.prisma.businessListing.update({
      where: { id },
      data: {
        isPromoted: false,
        promotedUntil: null,
        promotionPaidAt: null,
        promotionPaymentMethod: null
      }
    });

    return { success: true };
  }

  async sendPromotionLink(id: string) {
    const listing = await this.prisma.businessListing.findFirst({
      where: { id, deletedAt: null },
      include: { owner: { select: { id: true, email: true, name: true } } }
    });
    if (!listing) throw new NotFoundException('Business listing not found');

    const settings = await this.paymentsService.getPublicPaymentSettings();
    if (settings.provider === 'gocardless') {
      const { checkout, feeResult } = await this.createGoCardlessCheckout({
        amountPence: PROMOTION_PRICE_PENCE,
        description: `Promote ${listing.businessName} for 30 days`,
        metadata: { type: 'directory_promotion', businessListingId: id },
        successUrl: `${this.frontendUrl}/directory/${id}?promoted=success&session_id={BILLING_REQUEST_ID}&provider=gocardless`,
        cancelUrl: `${this.frontendUrl}/directory/${id}?promoted=cancel`,
        customerId: await this.goCardlessService.getOrCreateCustomer(listing.owner.id)
      });

      await this.prisma.payment.create({
        data: {
          userId: listing.owner.id,
          businessListingId: id,
          paymentChannel: 'gocardless',
          paymentMethod: 'direct_debit',
          paymentStatus: PaymentStatus.PENDING,
          providerCheckoutId: checkout.id,
          currency: 'GBP',
          grossAmount: feeResult.gross / 100,
          processingFee: feeResult.fee / 100,
          netAmount: feeResult.net / 100,
          description: `Directory promotion: ${listing.businessName}`,
          payerName: listing.owner.name,
          payerEmail: listing.owner.email,
          purchasedAt: new Date(),
          sourceType: PaymentSourceType.DIRECTORY_PROMOTION,
          sourceId: id
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
        provider: checkout.provider
      };
    }

    const stripeCustomerId = await this.paymentsService.getOrCreateStripeCustomer(
      listing.owner.id,
      listing.owner.email
    );

    const checkout = await this.paymentsService.createCheckout({
      amount: PROMOTION_PRICE_PENCE,
      currency: 'gbp',
      description: `Promote ${listing.businessName} for 30 days`,
      customer: stripeCustomerId,
      successUrl: `${this.frontendUrl}/directory/${id}?promoted=success&session_id={CHECKOUT_SESSION_ID}&provider=stripe`,
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

  /**
   * Shared GoCardless checkout creation for directory payments: a one-off
   * billing request + flow. The billing request metadata carries the Stripe
   * convention pence keys (netAmount/processingFee/grossAmount) so fulfilment
   * handlers read the same values as from a Stripe session.
   */
  private async createGoCardlessCheckout(input: {
    amountPence: number;
    description: string;
    metadata: Record<string, string>;
    successUrl: string;
    cancelUrl: string;
    customerId?: string;
    scheme?: 'bacs' | 'faster_payments';
  }) {
    const feeResult = this.paymentsService.calculateProcessingFee(input.amountPence, 'gocardless');
    const checkout = await this.goCardlessService.createBillingRequestFlow({
      plan: 'one_off',
      amountPence: feeResult.gross,
      description: input.description,
      scheme: input.scheme ?? 'bacs',
      metadata: {
        ...input.metadata,
        netAmount: String(feeResult.net),
        processingFee: String(feeResult.fee),
        grossAmount: String(feeResult.gross)
      },
      redirectUri: input.successUrl,
      exitUri: input.cancelUrl,
      ...(input.customerId ? { customerId: input.customerId } : {})
    });
    return { checkout, feeResult };
  }

  async handlePromotionCompleted(
    metadata: Record<string, string>,
    paymentMethod?: string,
    paymentContext?: {
      providerCheckoutId?: string | null;
      providerPaymentId?: string | null;
      amountPence?: number;
      currency?: string;
      payerEmail?: string | null;
      payerName?: string | null;
      payerPhone?: string | null;
      purchasedAt?: Date;
    }
  ) {
    const businessListingId = metadata.businessListingId;
    if (!businessListingId || metadata.type !== 'directory_promotion') return null;

    const existingPayment = await this.prisma.payment.findFirst({
      where: {
        businessListingId,
        providerCheckoutId: paymentContext?.providerCheckoutId ?? undefined
      }
    });
    if (existingPayment) {
      return { received: true, paymentId: existingPayment.id };
    }

    const promotedUntil = new Date();
    promotedUntil.setDate(promotedUntil.getDate() + 30);

    const listing = await this.prisma.businessListing.findFirst({
      where: { id: businessListingId, deletedAt: null },
      include: { owner: { select: { id: true, name: true, email: true, phone: true } } }
    });

    // Checkout flows pack the fee breakdown into the payment metadata (Stripe
    // session metadata, PayPal custom_id, GoCardless billing request data);
    // fall back to the collected amount with no fee when it is absent.
    const grossPence = metadata.grossAmount
      ? Number(metadata.grossAmount)
      : (paymentContext?.amountPence ?? PROMOTION_PRICE_PENCE);
    const feePence = metadata.processingFee ? Number(metadata.processingFee) : 0;
    const netPence = metadata.netAmount ? Number(metadata.netAmount) : grossPence - feePence;
    const currency = (paymentContext?.currency ?? 'GBP').toUpperCase();

    await this.prisma.$transaction(async (tx) => {
      await tx.businessListing.updateMany({
        where: { id: businessListingId, deletedAt: null },
        data: {
          isPromoted: true,
          promotedUntil,
          promotionPaidAt: paymentMethod ? new Date() : undefined,
          promotionPaymentMethod: paymentMethod ?? undefined
        }
      });
      await tx.payment.create({
        data: {
          userId: listing?.owner.id,
          businessListingId,
          paymentChannel: paymentMethod === 'offline' ? 'offline' : paymentMethod ?? 'stripe',
          paymentMethod: paymentMethod ?? null,
          paymentStatus: PaymentStatus.COMPLETED,
          providerCheckoutId: paymentContext?.providerCheckoutId ?? null,
          providerPaymentId: paymentContext?.providerPaymentId ?? null,
          currency,
          grossAmount: grossPence / 100,
          processingFee: feePence / 100,
          netAmount: netPence / 100,
          description: `Directory promotion: ${listing?.businessName ?? businessListingId}`,
          payerName: paymentContext?.payerName ?? listing?.owner.name ?? null,
          payerEmail: paymentContext?.payerEmail ?? listing?.owner.email ?? null,
          payerPhone: paymentContext?.payerPhone ?? listing?.owner.phone ?? null,
          purchasedAt: paymentContext?.purchasedAt ?? new Date(),
          sourceType: PaymentSourceType.DIRECTORY_PROMOTION,
          sourceId: businessListingId
        }
      });
    });

    return { received: true };
  }

  async handleJobPublishCompleted(
    metadata: Record<string, string>,
    paymentContext?: {
      providerCheckoutId?: string | null;
      providerPaymentId?: string | null;
      amountPence?: number;
      currency?: string;
      payerEmail?: string | null;
      payerName?: string | null;
      payerPhone?: string | null;
      purchasedAt?: Date;
    }
  ) {
    const jobAdId = metadata.jobAdId;
    if (!jobAdId || metadata.type !== 'job_publish') return null;

    const existingPayment = await this.prisma.payment.findFirst({
      where: {
        jobAdId,
        providerCheckoutId: paymentContext?.providerCheckoutId ?? undefined
      }
    });
    if (existingPayment) {
      return { received: true, paymentId: existingPayment.id };
    }

    const job = await this.prisma.jobAd.findFirst({
      where: { id: jobAdId, deletedAt: null },
      include: {
        businessListing: {
          include: { owner: { select: { id: true, name: true, email: true, phone: true } } }
        }
      }
    });

    const amount = (paymentContext?.amountPence ?? JOB_PUBLISH_PRICE_PENCE) / 100;
    const currency = (paymentContext?.currency ?? 'GBP').toUpperCase();

    await this.prisma.$transaction(async (tx) => {
      await tx.jobAd.updateMany({
        where: { id: jobAdId, deletedAt: null },
        data: { isPublished: true, publishPaidAt: new Date() }
      });
      await tx.payment.create({
        data: {
          userId: job?.businessListing?.owner.id,
          jobAdId,
          paymentChannel: paymentContext?.providerCheckoutId ? 'stripe' : 'offline',
          paymentMethod: paymentContext?.providerCheckoutId ? 'card' : 'offline',
          paymentStatus: PaymentStatus.COMPLETED,
          providerCheckoutId: paymentContext?.providerCheckoutId ?? null,
          providerPaymentId: paymentContext?.providerPaymentId ?? null,
          currency,
          grossAmount: amount,
          processingFee: 0,
          netAmount: amount,
          description: `Job publish: ${job?.title ?? jobAdId}`,
          payerName: paymentContext?.payerName ?? job?.businessListing?.owner.name ?? null,
          payerEmail: paymentContext?.payerEmail ?? job?.businessListing?.owner.email ?? null,
          payerPhone: paymentContext?.payerPhone ?? job?.businessListing?.owner.phone ?? null,
          purchasedAt: paymentContext?.purchasedAt ?? new Date(),
          sourceType: PaymentSourceType.JOB_PUBLISH,
          sourceId: jobAdId
        }
      });
    });

    return { received: true };
  }

  /**
   * Fulfil a confirmed GoCardless payment for a directory promotion or job
   * publishing. The pending Payment row created when the billing request flow
   * started is updated in place (no duplicate row); when there is none, a
   * completed row keyed by the billing request id is created instead. Both
   * paths are idempotent by providerPaymentId.
   */
  async handleGoCardlessPaymentCompleted(
    payment: GoCardlessPaymentResource,
    metadata: Record<string, string>,
    kind: 'directory_promotion' | 'job_publish' = 'directory_promotion'
  ) {
    if (kind === 'job_publish') {
      return this.handleGoCardlessJobPublishCompleted(payment, metadata);
    }
    if (metadata.type !== 'directory_promotion') return null;

    const businessListingId = metadata.businessListingId;
    if (!businessListingId) return null;

    const billingRequestId = payment.links?.billing_request ?? null;
    const pendingPayment = billingRequestId
      ? await this.prisma.payment.findFirst({
          where: { providerCheckoutId: billingRequestId, businessListingId }
        })
      : null;

    if (pendingPayment) {
      if (pendingPayment.providerPaymentId === payment.id && pendingPayment.paymentStatus === PaymentStatus.COMPLETED) {
        return { received: true, paymentId: pendingPayment.id };
      }

      const promotedUntil = new Date();
      promotedUntil.setDate(promotedUntil.getDate() + 30);
      // The checkout flow charged the gross amount and packed the fee breakdown
      // into the billing request metadata; fall back to the collected amount
      // with no fee for older billing requests.
      const grossPence = metadata.grossAmount ? Number(metadata.grossAmount) : Number(payment.amount ?? PROMOTION_PRICE_PENCE);
      const feePence = metadata.processingFee ? Number(metadata.processingFee) : 0;
      const netPence = metadata.netAmount ? Number(metadata.netAmount) : grossPence - feePence;
      const amount = grossPence / 100;

      await this.prisma.$transaction([
        this.prisma.businessListing.updateMany({
          where: { id: businessListingId, deletedAt: null },
          data: {
            isPromoted: true,
            promotedUntil,
            promotionPaidAt: new Date(),
            promotionPaymentMethod: 'gocardless'
          }
        }),
        this.prisma.payment.update({
          where: { id: pendingPayment.id },
          data: {
            paymentStatus: PaymentStatus.COMPLETED,
            providerPaymentId: payment.id ?? null,
            currency: (payment.currency ?? 'GBP').toUpperCase(),
            grossAmount: amount,
            processingFee: feePence / 100,
            netAmount: netPence / 100,
            purchasedAt: payment.created_at ? new Date(payment.created_at) : new Date(),
            paymentMethod: 'direct_debit'
          }
        })
      ]);
      return { received: true, paymentId: pendingPayment.id };
    }

    return this.handlePromotionCompleted(metadata, 'gocardless', {
      providerCheckoutId: billingRequestId,
      providerPaymentId: payment.id ?? null,
      amountPence: payment.amount ? Number(payment.amount) : undefined,
      currency: payment.currency ?? 'GBP',
      purchasedAt: payment.created_at ? new Date(payment.created_at) : new Date()
    });
  }

  private async handleGoCardlessJobPublishCompleted(
    payment: GoCardlessPaymentResource,
    metadata: Record<string, string>
  ) {
    if (metadata.type !== 'job_publish') return null;

    const jobAdId = metadata.jobAdId;
    if (!jobAdId) return null;

    const billingRequestId = payment.links?.billing_request ?? null;
    const pendingPayment = billingRequestId
      ? await this.prisma.payment.findFirst({
          where: { providerCheckoutId: billingRequestId, jobAdId }
        })
      : null;

    if (pendingPayment) {
      if (pendingPayment.providerPaymentId === payment.id && pendingPayment.paymentStatus === PaymentStatus.COMPLETED) {
        return { received: true, paymentId: pendingPayment.id };
      }

      const amount = Number(payment.amount ?? JOB_PUBLISH_PRICE_PENCE) / 100;

      await this.prisma.$transaction([
        this.prisma.jobAd.updateMany({
          where: { id: jobAdId, deletedAt: null },
          data: { isPublished: true, publishPaidAt: new Date() }
        }),
        this.prisma.payment.update({
          where: { id: pendingPayment.id },
          data: {
            paymentStatus: PaymentStatus.COMPLETED,
            providerPaymentId: payment.id ?? null,
            currency: (payment.currency ?? 'GBP').toUpperCase(),
            grossAmount: amount,
            processingFee: 0,
            netAmount: amount,
            purchasedAt: payment.created_at ? new Date(payment.created_at) : new Date(),
            paymentChannel: 'gocardless',
            paymentMethod: 'direct_debit'
          }
        })
      ]);
      return { received: true, paymentId: pendingPayment.id };
    }

    // No pending row (e.g. checkout predates pending rows): fulfil directly,
    // creating a completed payment row keyed by the billing request id. The
    // stripe-specific handleJobPublishCompleted hardcodes its channel, so the
    // GoCardless path is kept separate.
    const job = await this.prisma.jobAd.findFirst({
      where: { id: jobAdId, deletedAt: null },
      include: {
        businessListing: {
          include: { owner: { select: { id: true, name: true, email: true, phone: true } } }
        }
      }
    });
    const amount = Number(payment.amount ?? JOB_PUBLISH_PRICE_PENCE) / 100;
    const existingPayment = billingRequestId
      ? await this.prisma.payment.findFirst({
          where: { jobAdId, providerCheckoutId: billingRequestId }
        })
      : null;
    if (existingPayment) {
      return { received: true, paymentId: existingPayment.id };
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.jobAd.updateMany({
        where: { id: jobAdId, deletedAt: null },
        data: { isPublished: true, publishPaidAt: new Date() }
      });
      await tx.payment.create({
        data: {
          userId: job?.businessListing?.owner.id,
          jobAdId,
          paymentChannel: 'gocardless',
          paymentMethod: 'direct_debit',
          paymentStatus: PaymentStatus.COMPLETED,
          providerCheckoutId: billingRequestId,
          providerPaymentId: payment.id ?? null,
          currency: (payment.currency ?? 'GBP').toUpperCase(),
          grossAmount: amount,
          processingFee: 0,
          netAmount: amount,
          description: `Job publish: ${job?.title ?? jobAdId}`,
          payerName: job?.businessListing?.owner.name ?? null,
          payerEmail: job?.businessListing?.owner.email ?? null,
          payerPhone: job?.businessListing?.owner.phone ?? null,
          purchasedAt: payment.created_at ? new Date(payment.created_at) : new Date(),
          sourceType: PaymentSourceType.JOB_PUBLISH,
          sourceId: jobAdId
        }
      });
    });

    return { received: true };
  }
}
