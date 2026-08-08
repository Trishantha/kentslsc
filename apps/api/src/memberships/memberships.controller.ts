import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  Res,
  Headers,
  RawBody,
  HttpCode,
  HttpStatus,
  NotFoundException
} from '@nestjs/common';
import type { Response } from 'express';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { MembershipsService } from './memberships.service.js';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard.js';
import { RolesGuard } from '../common/guards/roles.guard.js';
import { Roles } from '../common/decorators/roles.decorator.js';
import { Public } from '../common/decorators/public.decorator.js';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import { UserRole, type TokenPayload, MembershipFeature, membershipFeatureLabels } from '@kentslsc/shared';
import { RequiresFeature } from '../common/decorators/requires-feature.decorator.js';
import { FeatureGuard } from '../common/guards/feature.guard.js';
import { CreateMembershipTypeDto } from './dto/create-membership-type.dto.js';
import { UpdateMembershipTypeDto } from './dto/update-membership-type.dto.js';
import { ApplyMembershipDto } from './dto/apply-membership.dto.js';
import { RegenerateCardDto } from './dto/regenerate-card.dto.js';

@ApiTags('Memberships')
@Controller('membership')
export class MembershipsController {
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
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth()
  async createType(@Body() dto: CreateMembershipTypeDto) {
    return this.membershipsService.createType(dto);
  }

  @Patch('types/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth()
  async updateType(@Param('id') id: string, @Body() dto: UpdateMembershipTypeDto) {
    return this.membershipsService.updateType(id, dto);
  }

  @Delete('types/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth()
  async deleteType(@Param('id') id: string) {
    return this.membershipsService.deleteType(id);
  }

  @Post('apply')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  async apply(@CurrentUser() user: TokenPayload, @Body() dto: ApplyMembershipDto) {
    return this.membershipsService.apply(user, dto);
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  async getMyMembership(@CurrentUser() user: TokenPayload) {
    return this.membershipsService.findMyMembership(user.sub);
  }

  @Get('card')
  @RequiresFeature(MembershipFeature.MEMBER_CARD)
  @UseGuards(JwtAuthGuard, FeatureGuard)
  @ApiBearerAuth()
  async getCard(
    @CurrentUser() user: TokenPayload,
    @Query('membershipId') membershipId: string | undefined,
    @Res({ passthrough: true }) res: Response
  ) {
    let publicId = membershipId;
    if (!publicId) {
      const membership = await this.membershipsService.findMyMembership(user.sub);
      if (!membership) throw new Error('No membership found');
      publicId = membership.membershipId;
    }
    const cardPath = await this.membershipsService.getCardImage(publicId!);

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
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth()
  async regenerateCard(@Body() dto: RegenerateCardDto) {
    return this.membershipsService.regenerateCard(dto.membershipId);
  }

  @Post('webhook')
  @Public()
  @HttpCode(HttpStatus.OK)
  async webhook(
    @Headers('stripe-signature') signature: string,
    @RawBody() rawBody: Buffer
  ) {
    return this.membershipsService.handleWebhook(rawBody, signature);
  }
}
