import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../core/prisma/prisma.service.js';
import { UsersService } from '../users/users.service.js';
import { MembershipsService } from '../memberships/memberships.service.js';
import { EventsService } from '../events/events.service.js';
import { DirectoryService } from '../directory/directory.service.js';
import { FundraisingService } from '../fundraising/fundraising.service.js';
import { BlogService } from '../blog/blog.service.js';
import { CommitteeService } from '../committee/committee.service.js';
import { PaymentsService } from '../payments/payments.service.js';
import { EmailService } from '../email/email.service.js';
import type { TokenPayload, DependantInput } from '@kentslsc/shared';
import {
  MembershipStatus as MembershipStatusDto,
  ContactStatus as ContactStatusDto
} from '@kentslsc/shared';
import {
  MembershipStatus as DbMembershipStatus,
  ContactStatus as DbContactStatus
} from '@kentslsc/database';
import type { AdminCreateMembershipDto } from './dto/create-user-membership.dto.js';

@Injectable()
export class AdminService {
  private readonly logger = new Logger(AdminService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly usersService: UsersService,
    private readonly membershipsService: MembershipsService,
    private readonly eventsService: EventsService,
    private readonly directoryService: DirectoryService,
    private readonly fundraisingService: FundraisingService,
    private readonly blogService: BlogService,
    private readonly committeeService: CommitteeService,
    private readonly paymentsService: PaymentsService,
    private readonly emailService: EmailService,
    private readonly configService: ConfigService
  ) {}

  private get frontendUrl(): string {
    return this.configService.get<string>('FRONTEND_URL') ?? 'http://localhost:3000';
  }

  async getDashboardStats() {
    const [
      users,
      memberships,
      pendingMemberships,
      events,
      listings,
      fundraisers,
      blogPosts,
      contactMessages,
      flaggedTopics,
      flaggedPosts
    ] = await Promise.all([
      this.prisma.user.count({ where: { deletedAt: null } }),
      this.prisma.membership.count({ where: { deletedAt: null } }),
      this.prisma.membership.count({
        where: {
          deletedAt: null,
          status: {
            in: [
              DbMembershipStatus.PENDING,
              DbMembershipStatus.AWAITING_APPROVAL,
              DbMembershipStatus.AWAITING_PAYMENT
            ]
          }
        }
      }),
      this.prisma.event.count({ where: { deletedAt: null } }),
      this.prisma.businessListing.count({ where: { deletedAt: null } }),
      this.prisma.fundraiser.count({ where: { deletedAt: null } }),
      this.prisma.blogPost.count({ where: { deletedAt: null } }),
      this.prisma.contactMessage.count({ where: { deletedAt: null } }),
      this.prisma.forumTopic.count({ where: { deletedAt: null, isFlagged: true } }),
      this.prisma.forumPost.count({ where: { deletedAt: null, isFlagged: true } })
    ]);

    return {
      users,
      memberships,
      pendingMemberships,
      events,
      listings,
      fundraisers,
      blogPosts,
      contactMessages,
      flaggedForumItems: flaggedTopics + flaggedPosts
    };
  }

  listUsers(page: number, limit: number, role?: string, search?: string) {
    return this.usersService.listUsers(page, limit, role, search);
  }

  exportUsers(role?: string, search?: string) {
    return this.usersService.exportUsers(role, search);
  }

  findUserById(id: string) {
    return this.usersService.findByIdWithDetails(id);
  }

  listMemberships(page: number, limit: number, status?: string) {
    const where: { deletedAt: null; status?: DbMembershipStatus } = { deletedAt: null };
    if (status && Object.values(DbMembershipStatus).includes(status as DbMembershipStatus)) {
      where.status = status as DbMembershipStatus;
    }

    const skip = (page - 1) * limit;
    return Promise.all([
      this.prisma.membership.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          user: { select: { id: true, name: true, email: true } },
          membershipType: true
        }
      }),
      this.prisma.membership.count({ where })
    ]).then(([items, total]) => ({
      items: items.map((item) => ({
        ...item,
        membershipType: {
          ...item.membershipType,
          price: Number(item.membershipType.price)
        },
        progressStage: this.membershipsService.computeProgressStage(item)
      })),
      total,
      page,
      limit
    }));
  }

  async exportMemberships(status?: string) {
    const where: { deletedAt: null; status?: DbMembershipStatus } = { deletedAt: null };
    if (status && Object.values(DbMembershipStatus).includes(status as DbMembershipStatus)) {
      where.status = status as DbMembershipStatus;
    }

    const memberships = await this.prisma.membership.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        user: true,
        membershipType: true
      }
    });

    return memberships.map((m) => {
      const address = m.user.address as
        | { buildingStreet?: string; locality?: string; townCity?: string; postcode?: string }
        | null;
      const dependants = (m.dependantsJson as Array<{ name: string; relationship: string }> | null) ?? [];

      return {
        membershipId: m.membershipId,
        membershipStatus: m.status,
        membershipType: m.membershipType.name,
        membershipTypeDescription: m.membershipType.description ?? '',
        membershipPrice: Number(m.membershipType.price),
        membershipDurationMonths: m.membershipType.durationMonths,
        startDate: m.startDate ? m.startDate.toISOString() : null,
        endDate: m.endDate ? m.endDate.toISOString() : null,
        issuedAt: m.issuedAt ? m.issuedAt.toISOString() : null,
        paidAt: m.paidAt ? m.paidAt.toISOString() : null,
        paymentMethod: m.paymentMethod ?? '',
        subscriptionStatus: m.subscriptionStatus ?? '',
        creditAmountApplied: m.creditAmountApplied ? Number(m.creditAmountApplied) : null,
        creditMonthsGranted: m.creditMonthsGranted ?? null,
        membershipCardUrl: m.membershipCardUrl ?? '',
        qrCodeValue: m.qrCodeValue ?? '',
        dependantsCount: dependants.length,
        dependants: dependants.map((d) => `${d.name} (${d.relationship})`).join('; '),
        memberId: m.user.id,
        memberName: m.user.name,
        memberFirstName: m.user.firstName ?? '',
        memberLastName: m.user.lastName ?? '',
        memberEmail: m.user.email,
        memberPhone: m.user.phone ?? '',
        memberRole: m.user.role,
        memberStatus: m.user.status,
        memberEmailVerifiedAt: m.user.emailVerifiedAt ? m.user.emailVerifiedAt.toISOString() : null,
        memberCreatedAt: m.user.createdAt.toISOString(),
        buildingStreet: address?.buildingStreet ?? '',
        locality: address?.locality ?? '',
        townCity: address?.townCity ?? '',
        postcode: address?.postcode ?? ''
      };
    });
  }

  updateMembershipStatus(id: string, status: MembershipStatusDto, confirmManualPayment?: boolean) {
    return this.membershipsService.updateStatus(id, status as DbMembershipStatus, confirmManualPayment);
  }

  approveMembership(id: string) {
    return this.membershipsService.approveAndRequestPayment(id);
  }

  rejectMembership(id: string, reason?: string) {
    return this.membershipsService.rejectMembership(id, reason);
  }

  findMembership(id: string) {
    return this.membershipsService.findMembershipById(id);
  }

  async createMembershipForUser(userId: string, dto: AdminCreateMembershipDto) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId, deletedAt: null },
      select: { id: true, name: true, firstName: true, lastName: true, email: true, phone: true, address: true, status: true }
    });
    if (!user) throw new NotFoundException('User not found');
    if (user.status === 'BANNED') {
      throw new BadRequestException('Cannot create a membership for a banned user');
    }

    const fullName = dto.fullName?.trim() || `${user.firstName ?? ''} ${user.lastName ?? ''}`.trim() || user.name;
    const address = user.address as { buildingStreet?: string; locality?: string; townCity?: string; postcode?: string } | null;

    const membershipType = await this.membershipsService.findTypeById(dto.membershipTypeId);
    const isPaidType = !membershipType.isFree && Number(membershipType.price) > 0;
    const paymentMode = dto.paymentMode ?? (isPaidType ? 'online' : undefined);

    const baseData = {
      userId: user.id,
      membershipTypeId: dto.membershipTypeId,
      fullName,
      address: address
        ? {
            buildingStreet: address.buildingStreet ?? '',
            locality: address.locality,
            townCity: address.townCity ?? '',
            postcode: address.postcode ?? ''
          }
        : undefined,
      phone: user.phone ?? undefined,
      dependants: dto.dependants ?? [],
      membershipType,
      overrideEmail: user.email
    };

    let membership: Awaited<ReturnType<typeof this.membershipsService.createMembership>>;

    if (!isPaidType) {
      membership = await this.membershipsService.createMembership({
        ...baseData,
        status: dto.status as DbMembershipStatus | undefined
      });
    } else if (paymentMode === 'offline') {
      // Paid + offline: payment is recorded, but the membership still needs an
      // explicit admin activation before the card is generated.
      membership = await this.membershipsService.createMembership({
        ...baseData,
        status: DbMembershipStatus.AWAITING_APPROVAL,
        paidAt: new Date(),
        paymentMethod: 'offline'
      });
    } else {
      // Paid + online: create an awaiting-approval record. The admin will send
      // a payment link and then activate the membership once payment is received.
      membership = await this.membershipsService.createMembership({
        ...baseData,
        status: DbMembershipStatus.AWAITING_APPROVAL
      });
    }

    // Cancel previous effective memberships only after the new record has been
    // created successfully. This avoids leaving the user with no effective
    // membership if creation fails part-way through.
    await this.prisma.membership.updateMany({
      where: {
        userId,
        deletedAt: null,
        status: {
          in: [
            DbMembershipStatus.ACTIVE,
            DbMembershipStatus.PENDING,
            DbMembershipStatus.AWAITING_APPROVAL,
            DbMembershipStatus.AWAITING_PAYMENT
          ]
        },
        id: { not: membership.id }
      },
      data: { status: DbMembershipStatus.CANCELLED, updatedAt: new Date() }
    });

    if (!isPaidType) {
      return { membership, paid: false };
    }

    if (paymentMode === 'offline') {
      return { membership, paid: true, paymentMethod: 'offline' };
    }

    // Paid + online: the membership is awaiting admin approval. The admin must
    // explicitly approve it before a payment link is sent.
    return {
      membership,
      paid: true,
      paymentMethod: 'online',
      awaitingApproval: true
    };
  }

  async sendMembershipPaymentLink(membershipId: string) {
    const membership = await this.prisma.membership.findUnique({
      where: { id: membershipId, deletedAt: null },
      include: { membershipType: true, user: { select: { id: true, email: true, name: true, firstName: true, lastName: true } } }
    });
    if (!membership) throw new NotFoundException('Membership not found');
    if (
      membership.status !== DbMembershipStatus.PENDING &&
      membership.status !== DbMembershipStatus.AWAITING_PAYMENT
    ) {
      throw new BadRequestException('Only pending or awaiting-payment memberships can be sent a payment link');
    }
    if (membership.membershipType.isFree || Number(membership.membershipType.price) === 0) {
      throw new BadRequestException('Free memberships do not require payment');
    }

    const user = membership.user;
    const fullName = user.name;

    const stripeCustomerId = await this.paymentsService.getOrCreateStripeCustomer(user.id, user.email);
    const synced = await this.paymentsService.syncMembershipTypePrice({
      id: membership.membershipType.id,
      name: membership.membershipType.name,
      price: Number(membership.membershipType.price),
      durationMonths: membership.membershipType.durationMonths
    });

    await this.prisma.membership.update({
      where: { id: membership.id },
      data: { stripeCustomerId, stripePriceId: synced.priceId }
    });

    const checkout = await this.paymentsService.createSubscriptionCheckout({
      priceId: synced.priceId,
      customer: stripeCustomerId,
      successUrl: `${this.frontendUrl}/dashboard?membership=success&session_id={CHECKOUT_SESSION_ID}&provider=stripe`,
      cancelUrl: `${this.frontendUrl}/dashboard?membership=canceled`,
      metadata: {
        source: 'membership',
        membershipId: membership.id,
        userId: user.id,
        membershipTypeId: membership.membershipType.id,
        fullName,
        address: '',
        phone: '',
        dependants: JSON.stringify((membership.dependantsJson as Array<{ name: string; relationship: string }> | null) ?? [])
      }
    });

    await this.emailService.sendMembershipPaymentLink(
      user.email,
      fullName,
      membership.membershipType.name,
      checkout.url
    );

    return { url: checkout.url, provider: checkout.provider };
  }

  async sendPaymentRemindersToPending() {
    const pending = await this.prisma.membership.findMany({
      where: {
        deletedAt: null,
        status: { in: [DbMembershipStatus.PENDING, DbMembershipStatus.AWAITING_PAYMENT] },
        paidAt: null,
        paymentMethod: null,
        membershipType: { isFree: false, price: { gt: 0 } }
      },
      include: {
        membershipType: true,
        user: { select: { id: true, email: true, name: true, firstName: true, lastName: true } }
      }
    });

    let sent = 0;
    let failed = 0;

    for (const membership of pending) {
      const type = membership.membershipType;
      // Defensive guard: even if the query is mocked or drifts, only remind
      // memberships that are still pending, paid, and not free.
      if (
        type.isFree ||
        Number(type.price) === 0 ||
        membership.paidAt ||
        membership.paymentMethod
      ) {
        continue;
      }
      try {
        await this.sendMembershipPaymentLink(membership.id);
        sent += 1;
      } catch (err) {
        this.logger.warn(
          `Failed to send payment reminder for pending membership ${membership.id}: ${(err as Error).message}`
        );
        failed += 1;
      }
    }

    return { sent, failed, total: sent + failed };
  }

  regenerateMembershipCard(membershipId: string) {
    return this.membershipsService.regenerateCard(membershipId);
  }

  updateMembershipDependants(membershipId: string, dto: { dependants: DependantInput[] }) {
    return this.membershipsService.updateDependants(membershipId, dto.dependants);
  }

  updateUserDependants(userId: string, dto: { dependants: DependantInput[] }) {
    return this.membershipsService.updateDependantsForUser(userId, dto.dependants);
  }

  async regenerateAllMembershipCards(options: { onlyActive?: boolean } = {}) {
    // Unused options variable prefix removed for lint compliance
    void options;
    // Cards are only generated for active memberships. The onlyActive option is
    // preserved for API compatibility but is always enforced now.
    const where = {
      deletedAt: null,
      status: DbMembershipStatus.ACTIVE
    };

    const memberships = await this.prisma.membership.findMany({
      where,
      select: { membershipId: true }
    });

    let regenerated = 0;
    let failed = 0;
    const errors: { membershipId: string; error: string }[] = [];

    for (const membership of memberships) {
      try {
        await this.membershipsService.regenerateCard(membership.membershipId);
        regenerated += 1;
      } catch (err) {
        failed += 1;
        const message = err instanceof Error ? err.message : String(err);
        errors.push({ membershipId: membership.membershipId, error: message });
        this.logger.warn(
          `Failed to regenerate card for ${membership.membershipId}: ${message}`
        );
      }
    }

    return { regenerated, failed, total: regenerated + failed, errors };
  }

  listEvents(page: number, limit: number) {
    return this.eventsService.listAll(page, limit);
  }

  createEvent(dto: Parameters<EventsService['create']>[0]) {
    return this.eventsService.create(dto);
  }

  updateEvent(id: string, dto: Parameters<EventsService['update']>[1]) {
    return this.eventsService.update(id, dto);
  }

  removeEvent(id: string) {
    return this.eventsService.remove(id);
  }

  listBusinesses() {
    return this.directoryService.findBusinesses();
  }

  createBusiness(user: TokenPayload, dto: Parameters<DirectoryService['createBusiness']>[1]) {
    return this.directoryService.createBusiness(user, dto);
  }

  updateBusiness(user: TokenPayload, id: string, dto: Parameters<DirectoryService['updateBusiness']>[2]) {
    return this.directoryService.updateBusiness(user, id, dto);
  }

  removeBusiness(user: TokenPayload, id: string) {
    return this.directoryService.deleteBusiness(user, id);
  }

  promoteBusinessOffline(id: string) {
    return this.directoryService.promoteBusinessOffline(id);
  }

  sendPromotionLink(id: string) {
    return this.directoryService.sendPromotionLink(id);
  }

  listJobs() {
    return this.directoryService.findJobs();
  }

  createJob(user: TokenPayload, dto: Parameters<DirectoryService['createJob']>[1]) {
    return this.directoryService.createJob(user, dto);
  }

  updateJob(user: TokenPayload, id: string, dto: Parameters<DirectoryService['updateJob']>[2]) {
    return this.directoryService.updateJob(user, id, dto);
  }

  removeJob(user: TokenPayload, id: string) {
    return this.directoryService.deleteJob(user, id);
  }

  listFundraisers(page = 1, limit = 20) {
    return this.fundraisingService.listAll(page, limit);
  }

  createFundraiser(dto: Parameters<FundraisingService['create']>[0]) {
    // Admin-created campaigns go ACTIVE immediately (no organizerId)
    return this.fundraisingService.create(dto);
  }

  updateFundraiser(id: string, dto: Parameters<FundraisingService['update']>[1]) {
    return this.fundraisingService.update(id, dto);
  }

  removeFundraiser(id: string) {
    return this.fundraisingService.remove(id);
  }

  listPendingFundraisers() {
    return this.fundraisingService.listPendingApproval();
  }

  approveFundraiser(id: string) {
    return this.fundraisingService.approveFundraiser(id);
  }

  rejectFundraiser(id: string, reason?: string) {
    return this.fundraisingService.rejectFundraiser(id, reason);
  }

  recordOfflineDonation(fundraiserId: string, dto: Parameters<FundraisingService['recordOfflineDonation']>[1]) {
    return this.fundraisingService.recordOfflineDonation(fundraiserId, dto);
  }

  addFundraiserUpdate(
    fundraiserId: string,
    authorId: string,
    dto: Parameters<FundraisingService['addUpdateAsAdmin']>[2]
  ) {
    return this.fundraisingService.addUpdateAsAdmin(fundraiserId, authorId, dto);
  }

  getFundraisingStats() {
    return this.fundraisingService.getStats();
  }

  listBlogPosts() {
    return this.blogService.listAdmin();
  }

  createBlogPost(authorUserId: string, dto: Parameters<BlogService['create']>[1]) {
    return this.blogService.create(authorUserId, dto);
  }

  updateBlogPost(id: string, dto: Parameters<BlogService['update']>[1]) {
    return this.blogService.update(id, dto);
  }

  removeBlogPost(id: string) {
    return this.blogService.remove(id);
  }

  // ---------------------------------------------------------------------------
  // Committee
  // ---------------------------------------------------------------------------

  listCommittee() {
    return this.committeeService.findAll();
  }

  findCommitteeMember(id: string) {
    return this.committeeService.findById(id);
  }

  createCommittee(dto: Parameters<CommitteeService['create']>[0]) {
    return this.committeeService.create(dto);
  }

  updateCommittee(id: string, dto: Parameters<CommitteeService['update']>[1]) {
    return this.committeeService.update(id, dto);
  }

  removeCommittee(id: string) {
    return this.committeeService.remove(id);
  }

  async getFlaggedForumItems() {
    const [topics, posts] = await Promise.all([
      this.prisma.forumTopic.findMany({
        where: { deletedAt: null, isFlagged: true },
        orderBy: { createdAt: 'desc' },
        include: { user: { select: { id: true, name: true } }, category: true }
      }),
      this.prisma.forumPost.findMany({
        where: { deletedAt: null, isFlagged: true },
        orderBy: { createdAt: 'desc' },
        include: { user: { select: { id: true, name: true } }, topic: { select: { id: true, title: true } } }
      })
    ]);
    return { topics, posts };
  }

  async removeForumTopic(id: string) {
    const topic = await this.prisma.forumTopic.findFirst({ where: { id, deletedAt: null } });
    if (!topic) throw new NotFoundException('Forum topic not found');
    await this.prisma.forumTopic.update({ where: { id }, data: { deletedAt: new Date() } });
    return { id, deleted: true };
  }

  async removeForumPost(id: string) {
    const post = await this.prisma.forumPost.findFirst({ where: { id, deletedAt: null } });
    if (!post) throw new NotFoundException('Forum post not found');
    await this.prisma.forumPost.update({ where: { id }, data: { deletedAt: new Date() } });
    return { id, deleted: true };
  }

  listContactMessages() {
    return this.prisma.contactMessage.findMany({
      where: { deletedAt: null },
      orderBy: { createdAt: 'desc' }
    });
  }

  async findContactMessage(id: string) {
    const message = await this.prisma.contactMessage.findFirst({
      where: { id, deletedAt: null }
    });
    if (!message) throw new NotFoundException('Contact message not found');
    return message;
  }

  async updateContactStatus(id: string, status: ContactStatusDto) {
    const message = await this.prisma.contactMessage.findFirst({ where: { id, deletedAt: null } });
    if (!message) throw new NotFoundException('Contact message not found');
    return this.prisma.contactMessage.update({
      where: { id },
      data: { handledStatus: status as DbContactStatus }
    });
  }
}
