import {
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  Param,
  Post,
  Put,
  Query,
  RawBody,
  Res,
  UseGuards
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import type { TokenPayload } from '@kentslsc/shared';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard.js';
import { RolesGuard } from '../common/guards/roles.guard.js';
import { Roles } from '../common/decorators/roles.decorator.js';
import { RequiresFeature } from '../common/decorators/requires-feature.decorator.js';
import { FeatureGuard } from '../common/guards/feature.guard.js';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import { UserRole, MembershipFeature } from '@kentslsc/shared';
import { DirectoryService } from './directory.service.js';
import { PaymentsService } from '../payments/payments.service.js';
import { CreateBusinessListingDto } from './dto/create-business.dto.js';
import { UpdateBusinessListingDto } from './dto/update-business.dto.js';
import { CreateJobAdDto } from './dto/create-job.dto.js';
import { UpdateJobAdDto } from './dto/update-job.dto.js';

@ApiTags('Directory')
@Controller('directory')
export class DirectoryController {
  constructor(
    private readonly directoryService: DirectoryService,
    private readonly paymentsService: PaymentsService
  ) {}

  @Get('businesses')
  listBusinesses(
    @Query('search') search?: string,
    @Query('category') category?: string,
    @Query('promoted') promoted?: string
  ) {
    return this.directoryService.findBusinesses(search, category, promoted === 'true');
  }

  @Get('businesses/:id')
  getBusiness(@Param('id') id: string) {
    return this.directoryService.findBusinessById(id);
  }

  @Post('businesses')
  @RequiresFeature(MembershipFeature.DIRECTORY_LISTING)
  @UseGuards(JwtAuthGuard, FeatureGuard)
  @ApiBearerAuth()
  createBusiness(@CurrentUser() user: TokenPayload, @Body() dto: CreateBusinessListingDto) {
    return this.directoryService.createBusiness(user, dto);
  }

  @Put('businesses/:id')
  @RequiresFeature(MembershipFeature.DIRECTORY_LISTING)
  @UseGuards(JwtAuthGuard, FeatureGuard)
  @ApiBearerAuth()
  updateBusiness(
    @CurrentUser() user: TokenPayload,
    @Param('id') id: string,
    @Body() dto: UpdateBusinessListingDto
  ) {
    return this.directoryService.updateBusiness(user, id, dto);
  }

  @Delete('businesses/:id')
  @RequiresFeature(MembershipFeature.DIRECTORY_LISTING)
  @UseGuards(JwtAuthGuard, FeatureGuard)
  @ApiBearerAuth()
  deleteBusiness(@CurrentUser() user: TokenPayload, @Param('id') id: string) {
    return this.directoryService.deleteBusiness(user, id);
  }

  @Post('businesses/:id/promote')
  @RequiresFeature(MembershipFeature.DIRECTORY_PROMOTE)
  @UseGuards(JwtAuthGuard, FeatureGuard)
  @ApiBearerAuth()
  promoteBusiness(@CurrentUser() user: TokenPayload, @Param('id') id: string) {
    return this.directoryService.createPromotionCheckout(user, id);
  }

  @Post('businesses/:id/summarise')
  @RequiresFeature(MembershipFeature.DIRECTORY_LISTING)
  @UseGuards(JwtAuthGuard, FeatureGuard)
  @ApiBearerAuth()
  summariseBusiness(@CurrentUser() user: TokenPayload, @Param('id') id: string) {
    return this.directoryService.summariseBusiness(id);
  }

  @Get('jobs')
  listJobs(@Query('businessListingId') businessListingId?: string) {
    return this.directoryService.findJobs(businessListingId);
  }

  @Post('jobs')
  @RequiresFeature(MembershipFeature.DIRECTORY_LISTING)
  @UseGuards(JwtAuthGuard, FeatureGuard)
  @ApiBearerAuth()
  createJob(@CurrentUser() user: TokenPayload, @Body() dto: CreateJobAdDto) {
    return this.directoryService.createJob(user, dto);
  }

  @Put('jobs/:id')
  @RequiresFeature(MembershipFeature.DIRECTORY_LISTING)
  @UseGuards(JwtAuthGuard, FeatureGuard)
  @ApiBearerAuth()
  updateJob(
    @CurrentUser() user: TokenPayload,
    @Param('id') id: string,
    @Body() dto: UpdateJobAdDto
  ) {
    return this.directoryService.updateJob(user, id, dto);
  }

  @Delete('jobs/:id')
  @RequiresFeature(MembershipFeature.DIRECTORY_LISTING)
  @UseGuards(JwtAuthGuard, FeatureGuard)
  @ApiBearerAuth()
  deleteJob(@CurrentUser() user: TokenPayload, @Param('id') id: string) {
    return this.directoryService.deleteJob(user, id);
  }

  @Post('webhook')
  async webhook(
    @Headers('stripe-signature') signature: string,
    @RawBody() rawBody: Buffer,
    @Res() res: Response
  ) {
    try {
      const event = await this.paymentsService.constructEvent(rawBody, signature);
      if (event.type === 'checkout.session.completed') {
        await this.paymentsService.handleDirectoryPromotion(event.data.object as any);
      }
      return res.json({ received: true });
    } catch (err) {
      return res.status(400).send(`Webhook error: ${(err as Error).message}`);
    }
  }
}
