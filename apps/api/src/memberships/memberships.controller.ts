import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  Query,
  Res,
  Headers,
  RawBody,
  HttpCode,
  HttpStatus,
  BadRequestException, Logger
} from '@nestjs/common';
import type { Response } from 'express';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { MembershipsService } from './memberships.service.js';
import { PaymentsService } from '../payments/payments.service.js';
import { RequirePermission } from '../common/decorators/require-permission.decorator.js';
import { Public } from '../common/decorators/public.decorator.js';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import { Permission, type TokenPayload, MembershipFeature, membershipFeatureLabels } from '@kentslsc/shared';
import { CreateMembershipTypeDto } from './dto/create-membership-type.dto.js';
import { UpdateMembershipTypeDto } from './dto/update-membership-type.dto.js';
import { PauseMembershipTypeDto } from './dto/pause-membership-type.dto.js';
import { ApplyMembershipDto } from './dto/apply-membership.dto.js';
import { UpdateDependantsDto } from './dto/update-dependants.dto.js';
import { RegenerateCardDto } from './dto/regenerate-card.dto.js';
import { CreateMembershipScanDto } from './dto/create-membership-scan.dto.js';

@ApiTags('Memberships')
@Controller('membership')
export class MembershipsController {
  private readonly logger = new Logger(MembershipsController.name);

  constructor(
    private readonly membershipsService: MembershipsService,
    private readonly paymentsService: PaymentsService
  ) {}

  @Get('types')
  @Public()
  async getTypes(@Query('includePaused') includePaused: string | undefined) {
    return this.membershipsService.findTypes(includePaused === 'true');
  }

  @Get('features')
  @Public()
  async getFeatures() {
    return Object.values(MembershipFeature).map((value) => ({
      value,
      ...membershipFeatureLabels[value]
    }));
  }

  @Post('types')
  @RequirePermission(Permission.MANAGE_MEMBERSHIPS)
  @ApiBearerAuth()
  async createType(@Body() dto: CreateMembershipTypeDto) {
    return this.membershipsService.createType(dto);
  }

  @Patch('types/:id')
  @RequirePermission(Permission.MANAGE_MEMBERSHIPS)
  @ApiBearerAuth()
  async updateType(@Param('id') id: string, @Body() dto: UpdateMembershipTypeDto) {
    return this.membershipsService.updateType(id, dto);
  }

  @Post('types/:id/pause')
  @RequirePermission(Permission.MANAGE_MEMBERSHIPS)
  @ApiBearerAuth()
  async pauseType(@Param('id') id: string, @Body() dto: PauseMembershipTypeDto) {
    return this.membershipsService.pauseType(id, dto.targetMembershipTypeId);
  }

  @Post('types/:id/resume')
  @RequirePermission(Permission.MANAGE_MEMBERSHIPS)
  @ApiBearerAuth()
  async resumeType(@Param('id') id: string) {
    return this.membershipsService.resumeType(id);
  }

  @Post('apply')
  @ApiBearerAuth()
  async apply(@CurrentUser() user: TokenPayload, @Body() dto: ApplyMembershipDto) {
    return this.membershipsService.apply(user, dto);
  }

  @Post('billing-portal')
  @ApiBearerAuth()
  async billingPortal(@CurrentUser() user: TokenPayload) {
    const url = await this.membershipsService.createBillingPortalSession(user.sub);
    return { url };
  }

  @Get('me')
  @ApiBearerAuth()
  async getMyMembership(@CurrentUser() user: TokenPayload) {
    return this.membershipsService.findMyMembership(user.sub);
  }

  @Patch('me/dependants')
  @ApiBearerAuth()
  async updateMyDependants(
    @CurrentUser() user: TokenPayload,
    @Body() dto: UpdateDependantsDto
  ) {
    return this.membershipsService.updateDependantsForUser(user.sub, dto.dependants);
  }

  @Get('card')
  @ApiBearerAuth()
  async getCard(
    @CurrentUser() user: TokenPayload,
    @Query('membershipId') membershipId: string | undefined,
    @Query('t') timestamp: string | undefined,
    @Res({ passthrough: true }) res: Response
  ) {
    const cardUrl = await this.membershipsService.getCardForUser(user, membershipId);
    res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    // Append the cache-busting timestamp to the redirected storage URL as well,
    // otherwise the browser/CDN may keep serving the cached image even after a
    // card is regenerated at the same Supabase path.
    // Signed URLs already include a unique token, so adding extra query params
    // would break the signature; only bust public URLs.
    const isSigned = /[?&]token=/.test(cardUrl);
    let redirectUrl = cardUrl;
    if (!isSigned) {
      const bust = timestamp ?? Date.now().toString();
      const separator = cardUrl.includes('?') ? '&' : '?';
      redirectUrl = `${cardUrl}${separator}t=${encodeURIComponent(bust)}`;
    }
    return res.redirect(redirectUrl);
  }

  @Get('verify/:membershipId')
  @Public()
  async verify(@Param('membershipId') membershipId: string) {
    return this.membershipsService.verifyMembership(membershipId);
  }

  @Post('card/regenerate')
  @RequirePermission(Permission.MANAGE_MEMBERSHIPS)
  @ApiBearerAuth()
  async regenerateCard(@Body() dto: RegenerateCardDto) {
    return this.membershipsService.regenerateCard(dto.membershipId);
  }

  @Post('me/regenerate-card')
  @ApiBearerAuth()
  async regenerateMyCard(@CurrentUser() user: TokenPayload) {
    return this.membershipsService.regenerateMyCard(user.sub);
  }

  @Post('scans')
  @RequirePermission(Permission.SCAN_MEMBERSHIPS)
  @ApiBearerAuth()
  async recordScan(
    @CurrentUser() user: TokenPayload,
    @Body() dto: CreateMembershipScanDto
  ) {
    return this.membershipsService.recordScan(dto.qrCodeValue, user.sub);
  }

  @Get('scans')
  @RequirePermission(Permission.SCAN_MEMBERSHIPS)
  @ApiBearerAuth()
  async listScans(
    @Query('page') page: string,
    @Query('limit') limit: string
  ) {
    return this.membershipsService.listScans(
      Number(page) || 1,
      Number(limit) || 50
    );
  }

  @Post('webhook')
  @Public()
  @HttpCode(HttpStatus.OK)
  async webhook(
    @Headers('stripe-signature') signature: string,
    @Headers() headers: Record<string, string | string[] | undefined>,
    @RawBody() rawBody: Buffer,
    @Body() body: any
  ) {
    try {
      if (signature) {
        return await this.membershipsService.handleWebhook(rawBody, signature);
      }
      await this.paymentsService.verifyPayPalWebhook(rawBody, headers);
      return await this.membershipsService.handlePayPalWebhook(body);
    } catch (error) {
      // A bad or missing signature is a client error, not a server fault. Left
      // as a 500 it looks like an outage and Stripe's retries mask the real
      // cause. The message is deliberately generic — the detail goes to the log.
      this.logger.warn(`Membership webhook rejected: ${(error as Error).message}`);
      throw new BadRequestException('Webhook signature verification failed');
    }
  }
}
