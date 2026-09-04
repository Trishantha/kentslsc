import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Logger,
  Param,
  Patch,
  Post,
  Put,
  Query,
  Req
} from '@nestjs/common';
import type { Request } from 'express';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AdminService } from './admin.service.js';
import { Roles } from '../common/decorators/roles.decorator.js';
import { RequirePermission } from '../common/decorators/require-permission.decorator.js';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import { Permission, UserRole, type TokenPayload } from '@kentslsc/shared';
import { AdminUsersService } from './admin-users.service.js';
import { UsersService } from '../users/users.service.js';
import { AdminCreateUserDto, AdminUpdateRoleDto, AdminUpdateStatusDto } from './dto/admin-user.dto.js';
import {
  CreateRoleDto,
  UpdateRoleDto,
  AssignRoleDto,
  SetUserPermissionsDto
} from './dto/role.dto.js';
import {
  AddExistingBackOfficeUserDto,
  InviteBackOfficeUserDto
} from './dto/back-office-user.dto.js';
import type { RequestContext } from '../auth/sessions.service.js';
import { UpdateMembershipStatusDto } from './dto/update-membership-status.dto.js';
import { RejectMembershipDto } from './dto/reject-membership.dto.js';
import { AdminCreateMembershipDto } from './dto/create-user-membership.dto.js';
import { UpdateDependantsDto } from '../memberships/dto/update-dependants.dto.js';
import { SendMembershipPaymentLinkDto } from './dto/send-payment-link.dto.js';
import { UpdateContactStatusDto } from './dto/update-contact-status.dto.js';
import { CreateEventDto } from '../events/dto/create-event.dto.js';
import { UpdateEventDto } from '../events/dto/update-event.dto.js';
import { CreateBusinessListingDto } from '../directory/dto/create-business.dto.js';
import { UpdateBusinessListingDto } from '../directory/dto/update-business.dto.js';
import { CreateJobAdDto } from '../directory/dto/create-job.dto.js';
import { UpdateJobAdDto } from '../directory/dto/update-job.dto.js';
import { CreateFundraiserDto } from '../fundraising/dto/create-fundraiser.dto.js';
import { UpdateFundraiserDto } from '../fundraising/dto/update-fundraiser.dto.js';
import { RejectFundraiserDto } from '../fundraising/dto/reject-fundraiser.dto.js';
import { RecordOfflineDonationDto } from '../fundraising/dto/record-offline-donation.dto.js';
import { CreateFundraiserUpdateDto } from '../fundraising/dto/create-fundraiser-update.dto.js';
import { CreateBlogPostDto } from '../blog/dto/create-blog-post.dto.js';
import { UpdateBlogPostDto } from '../blog/dto/update-blog-post.dto.js';
import {
  CreateCommitteeMemberDto,
  UpdateCommitteeMemberDto
} from '../committee/dto/index.js';

@ApiTags('Admin')
@ApiBearerAuth()
@Controller('admin')
export class AdminController {
  private readonly logger = new Logger(AdminController.name);

  constructor(
    private readonly adminService: AdminService,
    private readonly adminUsers: AdminUsersService,
    private readonly usersService: UsersService
  ) {}

  private context(req: Request): RequestContext {
    return { ip: req.ip, userAgent: req.headers['user-agent'] };
  }

  // ---------------------------------------------------------------------------
  // Permission & role management (admin-only)
  // ---------------------------------------------------------------------------

  @Get('permissions')
  @Roles(UserRole.ADMIN)
  listPermissions() {
    return this.adminUsers.listPermissionDefinitions();
  }

  @Get('roles')
  @Roles(UserRole.ADMIN)
  listRoles() {
    return this.adminUsers.listRoles();
  }

  @Post('roles')
  @Roles(UserRole.ADMIN)
  createRole(@Body() dto: CreateRoleDto) {
    return this.adminUsers.createRole(dto);
  }

  @Get('roles/:id')
  @Roles(UserRole.ADMIN)
  findRole(@Param('id') id: string) {
    return this.adminUsers.findRole(id);
  }

  @Patch('roles/:id')
  @Roles(UserRole.ADMIN)
  updateRole(@Param('id') id: string, @Body() dto: UpdateRoleDto) {
    return this.adminUsers.updateBackOfficeRole(id, dto);
  }

  @Delete('roles/:id')
  @Roles(UserRole.ADMIN)
  deleteRole(@Param('id') id: string) {
    return this.adminUsers.deleteRole(id);
  }

  @Get('users/:id/permissions')
  @Roles(UserRole.ADMIN)
  getUserPermissions(@Param('id') id: string) {
    return this.adminUsers.getUserPermissions(id);
  }

  @Put('users/:id/permissions')
  @Roles(UserRole.ADMIN)
  setUserPermissions(
    @Param('id') id: string,
    @Body() dto: SetUserPermissionsDto
  ) {
    return this.adminUsers.setDirectPermissions(id, dto.permissions);
  }

  @Post('users/:id/permissions/:permission')
  @Roles(UserRole.ADMIN)
  grantUserPermission(
    @Param('id') id: string,
    @Param('permission') permission: Permission
  ) {
    return this.adminUsers.grantPermission(id, permission);
  }

  @Delete('users/:id/permissions/:permission')
  @Roles(UserRole.ADMIN)
  revokeUserPermission(
    @Param('id') id: string,
    @Param('permission') permission: Permission
  ) {
    return this.adminUsers.revokePermission(id, permission);
  }

  @Post('users/:id/role')
  @Roles(UserRole.ADMIN)
  assignBackOfficeRole(
    @Param('id') id: string,
    @Body() dto: AssignRoleDto
  ) {
    return this.adminUsers.assignRole(id, dto.roleId ?? null);
  }

  // ---------------------------------------------------------------------------
  // Back-office user onboarding
  // ---------------------------------------------------------------------------

  @Post('back-office-users/existing')
  @Roles(UserRole.ADMIN)
  addExistingBackOfficeUser(
    @CurrentUser() actor: TokenPayload,
    @Body() dto: AddExistingBackOfficeUserDto,
    @Req() req: Request
  ) {
    return this.adminUsers.addExistingBackOfficeUser(actor, dto, this.context(req));
  }

  @Post('back-office-users/invite')
  @Roles(UserRole.ADMIN)
  inviteBackOfficeUser(
    @CurrentUser() actor: TokenPayload,
    @Body() dto: InviteBackOfficeUserDto,
    @Req() req: Request
  ) {
    return this.adminUsers.inviteBackOfficeUser(actor, dto, this.context(req));
  }

  // ---------------------------------------------------------------------------
  // User management
  // ---------------------------------------------------------------------------

  /**
   * Create a user without touching the caller's session.
   *
   * Deliberately never calls setAuthCookies: the whole point is that an admin
   * can provision an account without being swapped into it.
   */
  @Post('users')
  @RequirePermission(Permission.MANAGE_USERS)
  createUser(
    @CurrentUser() actor: TokenPayload,
    @Body() dto: AdminCreateUserDto,
    @Req() req: Request
  ) {
    return this.adminUsers.createUser(actor, dto, this.context(req));
  }

  @Patch('users/:id/role')
  @Roles(UserRole.ADMIN)
  updateUserRole(
    @CurrentUser() actor: TokenPayload,
    @Param('id') id: string,
    @Body() dto: AdminUpdateRoleDto,
    @Req() req: Request
  ) {
    return this.adminUsers.updateRole(actor, id, dto.role, this.context(req));
  }

  @Patch('users/:id/status')
  @Roles(UserRole.ADMIN)
  updateUserStatus(
    @CurrentUser() actor: TokenPayload,
    @Param('id') id: string,
    @Body() dto: AdminUpdateStatusDto,
    @Req() req: Request
  ) {
    return this.adminUsers.updateStatus(actor, id, dto.status, this.context(req));
  }

  @Post('users/:id/memberships')
  @RequirePermission(Permission.MANAGE_MEMBERSHIPS)
  createUserMembership(
    @Param('id') id: string,
    @Body() dto: AdminCreateMembershipDto
  ) {
    return this.adminService.createMembershipForUser(id, dto);
  }

  @Post('users/:id/force-logout')
  @RequirePermission(Permission.MANAGE_USERS)
  forceLogout(@CurrentUser() actor: TokenPayload, @Param('id') id: string, @Req() req: Request) {
    return this.adminUsers.forceLogout(actor, id, this.context(req));
  }

  @Get('dashboard')
  @RequirePermission(Permission.VIEW_ADMIN_DASHBOARD)
  dashboard() {
    return this.adminService.getDashboardStats();
  }

  @Get('users')
  @RequirePermission(Permission.MANAGE_USERS, Permission.MANAGE_TICKETS)
  listUsers(
    @Query('page') page: string,
    @Query('limit') limit: string,
    @Query('role') role?: string,
    @Query('search') search?: string
  ) {
    return this.adminService.listUsers(Number(page) || 1, Number(limit) || 20, role, search);
  }

  @Get('users/export')
  @RequirePermission(Permission.MANAGE_USERS)
  exportUsers(
    @Query('role') role?: string,
    @Query('search') search?: string
  ) {
    return this.adminService.exportUsers(role, search);
  }

  @Get('users/:id')
  @RequirePermission(Permission.MANAGE_USERS, Permission.MANAGE_TICKETS)
  findUser(@Param('id') id: string) {
    return this.adminService.findUserById(id);
  }

  @Get('users/:id/transactions')
  @RequirePermission(Permission.MANAGE_USERS, Permission.MANAGE_TICKETS)
  getUserTransactions(@Param('id') id: string) {
    return this.usersService.getUserTransactions(id);
  }

  // ---------------------------------------------------------------------------
  // Memberships
  // ---------------------------------------------------------------------------

  @Get('memberships')
  @RequirePermission(Permission.MANAGE_MEMBERSHIPS)
  listMemberships(
    @Query('page') page: string,
    @Query('limit') limit: string,
    @Query('status') status?: string
  ) {
    return this.adminService.listMemberships(Number(page) || 1, Number(limit) || 20, status);
  }

  @Get('memberships/export')
  @RequirePermission(Permission.MANAGE_MEMBERSHIPS)
  exportMemberships(@Query('status') status?: string) {
    return this.adminService.exportMemberships(status);
  }

  @Get('memberships/:id')
  @RequirePermission(Permission.MANAGE_MEMBERSHIPS)
  findMembership(@Param('id') id: string) {
    return this.adminService.findMembership(id);
  }

  @Put('memberships/:id/status')
  @RequirePermission(Permission.MANAGE_MEMBERSHIPS)
  updateMembershipStatus(
    @Param('id') id: string,
    @Body() dto: UpdateMembershipStatusDto
  ) {
    return this.adminService.updateMembershipStatus(id, dto.status, dto.confirmManualPayment);
  }

  @Post('memberships/:id/approve')
  @RequirePermission(Permission.MANAGE_MEMBERSHIPS)
  approveMembership(@Param('id') id: string) {
    return this.adminService.approveMembership(id);
  }

  @Post('memberships/:id/reject')
  @RequirePermission(Permission.MANAGE_MEMBERSHIPS)
  rejectMembership(@Param('id') id: string, @Body() dto: RejectMembershipDto) {
    return this.adminService.rejectMembership(id, dto.reason);
  }

  @Post('memberships/:id/regenerate-card')
  @RequirePermission(Permission.MANAGE_MEMBERSHIPS)
  regenerateMembershipCard(@Param('id') membershipId: string) {
    return this.adminService.regenerateMembershipCard(membershipId);
  }

  @Put('memberships/:id/dependants')
  @RequirePermission(Permission.MANAGE_MEMBERSHIPS)
  updateMembershipDependants(
    @Param('id') membershipId: string,
    @Body() dto: UpdateDependantsDto
  ) {
    return this.adminService.updateMembershipDependants(membershipId, dto);
  }

  @Put('users/:id/dependants')
  @RequirePermission(Permission.MANAGE_MEMBERSHIPS)
  updateUserDependants(
    @Param('id') userId: string,
    @Body() dto: UpdateDependantsDto
  ) {
    return this.adminService.updateUserDependants(userId, dto);
  }

  @Post('memberships/regenerate-cards')
  @RequirePermission(Permission.MANAGE_MEMBERSHIPS)
  regenerateAllMembershipCards(@Body() dto: { onlyActive?: boolean }) {
    return this.adminService.regenerateAllMembershipCards({ onlyActive: dto?.onlyActive });
  }

  @Post('memberships/:id/send-payment-link')
  @RequirePermission(Permission.MANAGE_MEMBERSHIPS)
  sendMembershipPaymentLink(
    @Param('id') membershipId: string,
    @Body() dto: SendMembershipPaymentLinkDto
  ) {
    return this.adminService.sendMembershipPaymentLink(membershipId, dto);
  }

  @Post('memberships/send-payment-reminders')
  @RequirePermission(Permission.MANAGE_MEMBERSHIPS)
  sendPaymentRemindersToPending() {
    return this.adminService.sendPaymentRemindersToPending();
  }

  // ---------------------------------------------------------------------------
  // Events
  // ---------------------------------------------------------------------------

  @Get('events')
  @RequirePermission(Permission.MANAGE_EVENTS)
  listEvents(
    @Query('page') page: string,
    @Query('limit') limit: string
  ) {
    return this.adminService.listEvents(Number(page) || 1, Number(limit) || 20);
  }

  @Post('events')
  @RequirePermission(Permission.MANAGE_EVENTS)
  createEvent(@Body() dto: CreateEventDto) {
    return this.adminService.createEvent(dto);
  }

  @Put('events/:id')
  @RequirePermission(Permission.MANAGE_EVENTS)
  updateEvent(@Param('id') id: string, @Body() dto: UpdateEventDto) {
    return this.adminService.updateEvent(id, dto);
  }

  @Delete('events/:id')
  @RequirePermission(Permission.MANAGE_EVENTS)
  removeEvent(@Param('id') id: string) {
    return this.adminService.removeEvent(id);
  }

  @Post('events/:id/feature-free')
  @RequirePermission(Permission.MANAGE_EVENTS)
  featureEventFree(@Param('id') id: string) {
    return this.adminService.featureEventFree(id);
  }

  @Delete('events/:id/feature')
  @RequirePermission(Permission.MANAGE_EVENTS)
  unfeatureEvent(@Param('id') id: string) {
    return this.adminService.unfeatureEvent(id);
  }

  // ---------------------------------------------------------------------------
  // Directory
  // ---------------------------------------------------------------------------

  @Get('directory/businesses')
  @RequirePermission(Permission.MANAGE_DIRECTORY)
  listBusinesses() {
    return this.adminService.listBusinesses();
  }

  @Post('directory/businesses')
  @RequirePermission(Permission.MANAGE_DIRECTORY)
  createBusiness(@CurrentUser() user: TokenPayload, @Body() dto: CreateBusinessListingDto) {
    return this.adminService.createBusiness(user, dto);
  }

  @Put('directory/businesses/:id')
  @RequirePermission(Permission.MANAGE_DIRECTORY)
  updateBusiness(
    @CurrentUser() user: TokenPayload,
    @Param('id') id: string,
    @Body() dto: UpdateBusinessListingDto
  ) {
    return this.adminService.updateBusiness(user, id, dto);
  }

  @Delete('directory/businesses/:id')
  @RequirePermission(Permission.MANAGE_DIRECTORY)
  removeBusiness(@CurrentUser() user: TokenPayload, @Param('id') id: string) {
    return this.adminService.removeBusiness(user, id);
  }

  @Post('directory/businesses/:id/promote-offline')
  @RequirePermission(Permission.MANAGE_DIRECTORY)
  promoteBusinessOffline(@Param('id') id: string) {
    return this.adminService.promoteBusinessOffline(id);
  }

  @Post('directory/businesses/:id/promote-free')
  @RequirePermission(Permission.MANAGE_DIRECTORY)
  promoteBusinessFree(@Param('id') id: string) {
    return this.adminService.promoteBusinessFree(id);
  }

  @Delete('directory/businesses/:id/promotion')
  @RequirePermission(Permission.MANAGE_DIRECTORY)
  unpromoteBusiness(@Param('id') id: string) {
    return this.adminService.unpromoteBusiness(id);
  }

  @Post('directory/businesses/:id/send-promotion-link')
  @RequirePermission(Permission.MANAGE_DIRECTORY)
  sendPromotionLink(@Param('id') id: string) {
    return this.adminService.sendPromotionLink(id);
  }

  @Get('directory/jobs')
  @RequirePermission(Permission.MANAGE_JOBS)
  listJobs() {
    return this.adminService.listJobs();
  }

  @Post('directory/jobs')
  @RequirePermission(Permission.MANAGE_JOBS)
  createJob(@CurrentUser() user: TokenPayload, @Body() dto: CreateJobAdDto) {
    return this.adminService.createJob(user, dto);
  }

  @Put('directory/jobs/:id')
  @RequirePermission(Permission.MANAGE_JOBS)
  updateJob(
    @CurrentUser() user: TokenPayload,
    @Param('id') id: string,
    @Body() dto: UpdateJobAdDto
  ) {
    return this.adminService.updateJob(user, id, dto);
  }

  @Delete('directory/jobs/:id')
  @RequirePermission(Permission.MANAGE_JOBS)
  removeJob(@CurrentUser() user: TokenPayload, @Param('id') id: string) {
    return this.adminService.removeJob(user, id);
  }

  // ---------------------------------------------------------------------------
  // Fundraisers
  // ---------------------------------------------------------------------------

  @Get('fundraisers')
  @RequirePermission(Permission.MANAGE_FUNDRAISERS)
  listFundraisers(
    @Query('page') page: string,
    @Query('limit') limit: string
  ) {
    return this.adminService.listFundraisers(Number(page) || 1, Number(limit) || 20);
  }

  @Get('fundraisers/pending')
  @RequirePermission(Permission.MANAGE_FUNDRAISERS)
  listPendingFundraisers() {
    return this.adminService.listPendingFundraisers();
  }

  @Get('fundraisers/stats')
  @RequirePermission(Permission.MANAGE_FUNDRAISERS)
  getFundraisingStats() {
    return this.adminService.getFundraisingStats();
  }

  @Post('fundraisers')
  @RequirePermission(Permission.MANAGE_FUNDRAISERS)
  createFundraiser(@Body() dto: CreateFundraiserDto) {
    return this.adminService.createFundraiser(dto);
  }

  @Put('fundraisers/:id')
  @RequirePermission(Permission.MANAGE_FUNDRAISERS)
  updateFundraiser(@Param('id') id: string, @Body() dto: UpdateFundraiserDto) {
    return this.adminService.updateFundraiser(id, dto);
  }

  @Post('fundraisers/:id/approve')
  @RequirePermission(Permission.MANAGE_FUNDRAISERS)
  approveFundraiser(@Param('id') id: string) {
    return this.adminService.approveFundraiser(id);
  }

  @Post('fundraisers/:id/reject')
  @RequirePermission(Permission.MANAGE_FUNDRAISERS)
  rejectFundraiser(@Param('id') id: string, @Body() dto: RejectFundraiserDto) {
    return this.adminService.rejectFundraiser(id, dto.reason);
  }

  @Post('fundraisers/:id/offline-donation')
  @RequirePermission(Permission.MANAGE_FUNDRAISERS)
  recordOfflineDonation(@Param('id') id: string, @Body() dto: RecordOfflineDonationDto) {
    return this.adminService.recordOfflineDonation(id, dto);
  }

  @Post('fundraisers/:id/updates')
  @RequirePermission(Permission.MANAGE_FUNDRAISERS)
  addFundraiserUpdate(
    @Param('id') id: string,
    @Body() dto: CreateFundraiserUpdateDto,
    @CurrentUser() user: TokenPayload
  ) {
    return this.adminService.addFundraiserUpdate(id, user.sub, dto);
  }

  @Delete('fundraisers/:id')
  @RequirePermission(Permission.MANAGE_FUNDRAISERS)
  removeFundraiser(@Param('id') id: string) {
    return this.adminService.removeFundraiser(id);
  }

  // ---------------------------------------------------------------------------
  // Blog
  // ---------------------------------------------------------------------------

  @Get('blog/posts')
  @RequirePermission(Permission.MANAGE_BLOG)
  listBlogPosts() {
    return this.adminService.listBlogPosts();
  }

  @Post('blog/posts')
  @RequirePermission(Permission.MANAGE_BLOG)
  createBlogPost(@CurrentUser() user: TokenPayload, @Body() dto: CreateBlogPostDto) {
    return this.adminService.createBlogPost(user.sub, dto);
  }

  @Put('blog/posts/:id')
  @RequirePermission(Permission.MANAGE_BLOG)
  updateBlogPost(@Param('id') id: string, @Body() dto: UpdateBlogPostDto) {
    return this.adminService.updateBlogPost(id, dto);
  }

  @Delete('blog/posts/:id')
  @RequirePermission(Permission.MANAGE_BLOG)
  removeBlogPost(@Param('id') id: string) {
    return this.adminService.removeBlogPost(id);
  }

  // ---------------------------------------------------------------------------
  // Committee
  // ---------------------------------------------------------------------------

  @Get('committee')
  @RequirePermission(Permission.MANAGE_COMMITTEE)
  listCommittee() {
    return this.adminService.listCommittee();
  }

  @Get('committee/:id')
  @RequirePermission(Permission.MANAGE_COMMITTEE)
  findCommitteeMember(@Param('id') id: string) {
    return this.adminService.findCommitteeMember(id);
  }

  @Post('committee')
  @RequirePermission(Permission.MANAGE_COMMITTEE)
  createCommittee(@Body() dto: CreateCommitteeMemberDto) {
    return this.adminService.createCommittee(dto);
  }

  @Put('committee/:id')
  @RequirePermission(Permission.MANAGE_COMMITTEE)
  updateCommittee(
    @Param('id') id: string,
    @Body() dto: UpdateCommitteeMemberDto
  ) {
    return this.adminService.updateCommittee(id, dto);
  }

  @Delete('committee/:id')
  @RequirePermission(Permission.MANAGE_COMMITTEE)
  removeCommittee(@Param('id') id: string) {
    return this.adminService.removeCommittee(id);
  }

  // ---------------------------------------------------------------------------
  // Forum moderation
  // ---------------------------------------------------------------------------

  @Get('forum/flagged')
  @RequirePermission(Permission.MANAGE_FORUM)
  getFlaggedForumItems() {
    return this.adminService.getFlaggedForumItems();
  }

  @Delete('forum/topics/:id')
  @RequirePermission(Permission.MANAGE_FORUM)
  removeForumTopic(@Param('id') id: string) {
    return this.adminService.removeForumTopic(id);
  }

  @Delete('forum/posts/:id')
  @RequirePermission(Permission.MANAGE_FORUM)
  removeForumPost(@Param('id') id: string) {
    return this.adminService.removeForumPost(id);
  }

  // ---------------------------------------------------------------------------
  // Contact messages
  // ---------------------------------------------------------------------------

  @Get('contact-messages')
  @RequirePermission(Permission.MANAGE_CONTACT_MESSAGES)
  listContactMessages() {
    return this.adminService.listContactMessages();
  }

  @Get('contact-messages/:id')
  @RequirePermission(Permission.MANAGE_CONTACT_MESSAGES)
  findContactMessage(@Param('id') id: string) {
    return this.adminService.findContactMessage(id);
  }

  @Put('contact-messages/:id/status')
  @RequirePermission(Permission.MANAGE_CONTACT_MESSAGES)
  updateContactStatus(
    @Param('id') id: string,
    @Body() dto: UpdateContactStatusDto
  ) {
    return this.adminService.updateContactStatus(id, dto.status);
  }

  // ---------------------------------------------------------------------------
  // Server lifecycle
  // ---------------------------------------------------------------------------

  /**
   * Gracefully restart the API process.
   *
   * Hostinger's process manager will restart the app after the process exits,
   * which picks up any newly saved environment variables (e.g. Supabase keys).
   * This reuses the existing SIGTERM shutdown path so database connections,
   * sockets, and child processes are cleaned up correctly.
   */
  @Post('restart')
  @Roles(UserRole.ADMIN)
  @HttpCode(HttpStatus.ACCEPTED)
  restart() {
    this.logger.log('Admin restart requested; shutting down so Hostinger can restart the process');

    // Give the HTTP response time to flush before tearing down the process.
    setTimeout(() => {
      process.kill(process.pid, 'SIGTERM');
    }, 500);

    return { message: 'Restart initiated' };
  }

}
