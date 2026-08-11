import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../core/prisma/prisma.service.js';
import { UsersService } from '../users/users.service.js';
import { MembershipsService } from '../memberships/memberships.service.js';
import { EventsService } from '../events/events.service.js';
import { DirectoryService } from '../directory/directory.service.js';
import { FundraisingService } from '../fundraising/fundraising.service.js';
import { BlogService } from '../blog/blog.service.js';
import type { TokenPayload } from '@kentslsc/shared';
import {
  MembershipStatus as MembershipStatusDto,
  ContactStatus as ContactStatusDto
} from '@kentslsc/shared';
import {
  MembershipStatus as DbMembershipStatus,
  ContactStatus as DbContactStatus
} from '@kentslsc/database';

@Injectable()
export class AdminService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly usersService: UsersService,
    private readonly membershipsService: MembershipsService,
    private readonly eventsService: EventsService,
    private readonly directoryService: DirectoryService,
    private readonly fundraisingService: FundraisingService,
    private readonly blogService: BlogService
  ) {}

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
      this.prisma.membership.count({ where: { deletedAt: null, status: DbMembershipStatus.PENDING } }),
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

  listUsers(page: number, limit: number, role?: string) {
    return this.usersService.listUsers(page, limit, role);
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
    ]).then(([items, total]) => ({ items, total, page, limit }));
  }

  updateMembershipStatus(id: string, status: MembershipStatusDto) {
    return this.membershipsService.updateStatus(id, status as DbMembershipStatus);
  }

  regenerateMembershipCard(membershipId: string) {
    return this.membershipsService.regenerateCard(membershipId);
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

  async updateContactStatus(id: string, status: ContactStatusDto) {
    const message = await this.prisma.contactMessage.findFirst({ where: { id, deletedAt: null } });
    if (!message) throw new NotFoundException('Contact message not found');
    return this.prisma.contactMessage.update({
      where: { id },
      data: { handledStatus: status as DbContactStatus }
    });
  }
}
