import {
  Body,
  Controller,
  Delete,
  Get,
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
import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import { UserRole, type TokenPayload } from '@kentslsc/shared';
import { AdminUsersService } from './admin-users.service.js';
import { AdminCreateUserDto, AdminUpdateRoleDto } from './dto/admin-user.dto.js';
import type { RequestContext } from '../auth/sessions.service.js';
import { UpdateMembershipStatusDto } from './dto/update-membership-status.dto.js';
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

@ApiTags('Admin')
@Roles(UserRole.ADMIN)
@Controller('admin')
export class AdminController {
  constructor(
    private readonly adminService: AdminService,
    private readonly adminUsers: AdminUsersService
  ) {}

  private context(req: Request): RequestContext {
    return { ip: req.ip, userAgent: req.headers['user-agent'] };
  }

  /**
   * Create a user without touching the caller's session.
   *
   * Deliberately never calls setAuthCookies: the whole point is that an admin
   * can provision an account without being swapped into it.
   */
  @Post('users')
  @ApiBearerAuth()
  createUser(
    @CurrentUser() actor: TokenPayload,
    @Body() dto: AdminCreateUserDto,
    @Req() req: Request
  ) {
    return this.adminUsers.createUser(actor, dto, this.context(req));
  }

  @Patch('users/:id/role')
  @ApiBearerAuth()
  updateUserRole(
    @CurrentUser() actor: TokenPayload,
    @Param('id') id: string,
    @Body() dto: AdminUpdateRoleDto,
    @Req() req: Request
  ) {
    return this.adminUsers.updateRole(actor, id, dto.role, this.context(req));
  }

  @Post('users/:id/force-logout')
  @ApiBearerAuth()
  forceLogout(@Param('id') id: string, @Req() req: Request) {
    return this.adminUsers.forceLogout(id, this.context(req));
  }

  @Get('dashboard')
  @ApiBearerAuth()
  dashboard() {
    return this.adminService.getDashboardStats();
  }

  @Get('users')
  @ApiBearerAuth()
  listUsers(
    @Query('page') page: string,
    @Query('limit') limit: string,
    @Query('role') role?: string
  ) {
    return this.adminService.listUsers(Number(page) || 1, Number(limit) || 20, role);
  }

  @Get('users/:id')
  @ApiBearerAuth()
  findUser(@Param('id') id: string) {
    return this.adminService.findUserById(id);
  }

  @Get('memberships')
  @ApiBearerAuth()
  listMemberships(
    @Query('page') page: string,
    @Query('limit') limit: string,
    @Query('status') status?: string
  ) {
    return this.adminService.listMemberships(Number(page) || 1, Number(limit) || 20, status);
  }

  @Put('memberships/:id/status')
  @ApiBearerAuth()
  updateMembershipStatus(
    @Param('id') id: string,
    @Body() dto: UpdateMembershipStatusDto
  ) {
    return this.adminService.updateMembershipStatus(id, dto.status);
  }

  @Post('memberships/:id/regenerate-card')
  @ApiBearerAuth()
  regenerateMembershipCard(@Param('id') membershipId: string) {
    return this.adminService.regenerateMembershipCard(membershipId);
  }

  @Get('events')
  @ApiBearerAuth()
  listEvents(
    @Query('page') page: string,
    @Query('limit') limit: string
  ) {
    return this.adminService.listEvents(Number(page) || 1, Number(limit) || 20);
  }

  @Post('events')
  @ApiBearerAuth()
  createEvent(@Body() dto: CreateEventDto) {
    return this.adminService.createEvent(dto);
  }

  @Put('events/:id')
  @ApiBearerAuth()
  updateEvent(@Param('id') id: string, @Body() dto: UpdateEventDto) {
    return this.adminService.updateEvent(id, dto);
  }

  @Delete('events/:id')
  @ApiBearerAuth()
  removeEvent(@Param('id') id: string) {
    return this.adminService.removeEvent(id);
  }

  @Get('directory/businesses')
  @ApiBearerAuth()
  listBusinesses() {
    return this.adminService.listBusinesses();
  }

  @Post('directory/businesses')
  @ApiBearerAuth()
  createBusiness(@CurrentUser() user: TokenPayload, @Body() dto: CreateBusinessListingDto) {
    return this.adminService.createBusiness(user, dto);
  }

  @Put('directory/businesses/:id')
  @ApiBearerAuth()
  updateBusiness(
    @CurrentUser() user: TokenPayload,
    @Param('id') id: string,
    @Body() dto: UpdateBusinessListingDto
  ) {
    return this.adminService.updateBusiness(user, id, dto);
  }

  @Delete('directory/businesses/:id')
  @ApiBearerAuth()
  removeBusiness(@CurrentUser() user: TokenPayload, @Param('id') id: string) {
    return this.adminService.removeBusiness(user, id);
  }

  @Get('directory/jobs')
  @ApiBearerAuth()
  listJobs() {
    return this.adminService.listJobs();
  }

  @Post('directory/jobs')
  @ApiBearerAuth()
  createJob(@CurrentUser() user: TokenPayload, @Body() dto: CreateJobAdDto) {
    return this.adminService.createJob(user, dto);
  }

  @Put('directory/jobs/:id')
  @ApiBearerAuth()
  updateJob(
    @CurrentUser() user: TokenPayload,
    @Param('id') id: string,
    @Body() dto: UpdateJobAdDto
  ) {
    return this.adminService.updateJob(user, id, dto);
  }

  @Delete('directory/jobs/:id')
  @ApiBearerAuth()
  removeJob(@CurrentUser() user: TokenPayload, @Param('id') id: string) {
    return this.adminService.removeJob(user, id);
  }

  @Get('fundraisers')
  @ApiBearerAuth()
  listFundraisers(
    @Query('page') page: string,
    @Query('limit') limit: string
  ) {
    return this.adminService.listFundraisers(Number(page) || 1, Number(limit) || 20);
  }

  @Get('fundraisers/pending')
  @ApiBearerAuth()
  listPendingFundraisers() {
    return this.adminService.listPendingFundraisers();
  }

  @Get('fundraisers/stats')
  @ApiBearerAuth()
  getFundraisingStats() {
    return this.adminService.getFundraisingStats();
  }

  @Post('fundraisers')
  @ApiBearerAuth()
  createFundraiser(@Body() dto: CreateFundraiserDto) {
    return this.adminService.createFundraiser(dto);
  }

  @Put('fundraisers/:id')
  @ApiBearerAuth()
  updateFundraiser(@Param('id') id: string, @Body() dto: UpdateFundraiserDto) {
    return this.adminService.updateFundraiser(id, dto);
  }

  @Post('fundraisers/:id/approve')
  @ApiBearerAuth()
  approveFundraiser(@Param('id') id: string) {
    return this.adminService.approveFundraiser(id);
  }

  @Post('fundraisers/:id/reject')
  @ApiBearerAuth()
  rejectFundraiser(@Param('id') id: string, @Body() dto: RejectFundraiserDto) {
    return this.adminService.rejectFundraiser(id, dto.reason);
  }

  @Post('fundraisers/:id/offline-donation')
  @ApiBearerAuth()
  recordOfflineDonation(@Param('id') id: string, @Body() dto: RecordOfflineDonationDto) {
    return this.adminService.recordOfflineDonation(id, dto);
  }

  @Post('fundraisers/:id/updates')
  @ApiBearerAuth()
  addFundraiserUpdate(
    @Param('id') id: string,
    @Body() dto: CreateFundraiserUpdateDto,
    @CurrentUser() user: TokenPayload
  ) {
    return this.adminService.addFundraiserUpdate(id, user.sub, dto);
  }

  @Delete('fundraisers/:id')
  @ApiBearerAuth()
  removeFundraiser(@Param('id') id: string) {
    return this.adminService.removeFundraiser(id);
  }

  @Get('blog/posts')
  @ApiBearerAuth()
  listBlogPosts() {
    return this.adminService.listBlogPosts();
  }

  @Post('blog/posts')
  @ApiBearerAuth()
  createBlogPost(@CurrentUser() user: TokenPayload, @Body() dto: CreateBlogPostDto) {
    return this.adminService.createBlogPost(user.sub, dto);
  }

  @Put('blog/posts/:id')
  @ApiBearerAuth()
  updateBlogPost(@Param('id') id: string, @Body() dto: UpdateBlogPostDto) {
    return this.adminService.updateBlogPost(id, dto);
  }

  @Delete('blog/posts/:id')
  @ApiBearerAuth()
  removeBlogPost(@Param('id') id: string) {
    return this.adminService.removeBlogPost(id);
  }

  @Get('forum/flagged')
  @ApiBearerAuth()
  getFlaggedForumItems() {
    return this.adminService.getFlaggedForumItems();
  }

  @Delete('forum/topics/:id')
  @ApiBearerAuth()
  removeForumTopic(@Param('id') id: string) {
    return this.adminService.removeForumTopic(id);
  }

  @Delete('forum/posts/:id')
  @ApiBearerAuth()
  removeForumPost(@Param('id') id: string) {
    return this.adminService.removeForumPost(id);
  }

  @Get('contact-messages')
  @ApiBearerAuth()
  listContactMessages() {
    return this.adminService.listContactMessages();
  }

  @Put('contact-messages/:id/status')
  @ApiBearerAuth()
  updateContactStatus(
    @Param('id') id: string,
    @Body() dto: UpdateContactStatusDto
  ) {
    return this.adminService.updateContactStatus(id, dto.status);
  }
}
