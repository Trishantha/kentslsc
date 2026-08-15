import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  Res,
  Headers,
  RawBody,
  HttpCode,
  HttpStatus,
  NotFoundException, BadRequestException, Logger
} from '@nestjs/common';
import type { Response } from 'express';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { MembershipsService } from './memberships.service.js';
import { RequirePermission } from '../common/decorators/require-permission.decorator.js';
import { Public } from '../common/decorators/public.decorator.js';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import { Permission, type TokenPayload, MembershipFeature, membershipFeatureLabels } from '@kentslsc/shared';
import { CreateMembershipTypeDto } from './dto/create-membership-type.dto.js';
import { UpdateMembershipTypeDto } from './dto/update-membership-type.dto.js';
import { ApplyMembershipDto } from './dto/apply-membership.dto.js';
import { RegenerateCardDto } from './dto/regenerate-card.dto.js';

@ApiTags('Memberships')
@Controller('membership')
export class MembershipsController {
  private readonly logger = new Logger(MembershipsController.name);

  constructor(private readonly membershipsService: MembershipsService) {}

  @Get('types')
  @Public()
  async getTypes() {
    return this.membershipsService.findTypes();
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

  @Delete('types/:id')
  @RequirePermission(Permission.MANAGE_MEMBERSHIPS)
  @ApiBearerAuth()
  async deleteType(@Param('id') id: string) {
    return this.membershipsService.deleteType(id);
  }

  @Post('apply')
  @ApiBearerAuth()
  async apply(@CurrentUser() user: TokenPayload, @Body() dto: ApplyMembershipDto) {
    return this.membershipsService.apply(user, dto);
  }

  @Get('me')
  @ApiBearerAuth()
  async getMyMembership(@CurrentUser() user: TokenPayload) {
    return this.membershipsService.findMyMembership(user.sub);
  }

  @Get('card')
  @ApiBearerAuth()
  async getCard(
    @CurrentUser() user: TokenPayload,
    @Query('membershipId') membershipId: string | undefined,
    @Res({ passthrough: true }) res: Response
  ) {
    const cardPath = await this.membershipsService.getCardForUser(user, membershipId);

    if (cardPath.startsWith('http')) {
      return res.redirect(cardPath);
    }

    throw new NotFoundException('Membership card is not available in storage');
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

  @Post('webhook')
  @Public()
  @HttpCode(HttpStatus.OK)
  async webhook(
    @Headers('stripe-signature') signature: string,
    @RawBody() rawBody: Buffer,
    @Body() body: Record<string, unknown>
  ) {
    try {
      if (signature) {
        return await this.membershipsService.handleWebhook(rawBody, signature);
      }
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
