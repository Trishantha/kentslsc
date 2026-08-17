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
  Res
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import type { TokenPayload } from '@kentslsc/shared';
import { RequiresFeature } from '../common/decorators/requires-feature.decorator.js';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import { MembershipFeature } from '@kentslsc/shared';
import { DirectoryService } from './directory.service.js';
import { PaymentsService } from '../payments/payments.service.js';
import { CreateBusinessListingDto } from './dto/create-business.dto.js';
import { UpdateBusinessListingDto } from './dto/update-business.dto.js';
import { CreateJobAdDto } from './dto/create-job.dto.js';
import { UpdateJobAdDto } from './dto/update-job.dto.js';
import { Public } from '../common/decorators/public.decorator.js';

@ApiTags('Directory')
@Controller('directory')
export class DirectoryController {
  constructor(
    private readonly directoryService: DirectoryService,
    private readonly paymentsService: PaymentsService
  ) {}

  @Get('businesses')
  @Public()
  listBusinesses(
    @Query('search') search?: string,
    @Query('category') category?: string,
    @Query('promoted') promoted?: string
  ) {
    return this.directoryService.findBusinesses(search, category, promoted === 'true');
  }

  @Get('businesses/:id')
  @Public()
  getBusiness(@Param('id') id: string) {
    return this.directoryService.findBusinessById(id);
  }

  @Post('businesses')
  @RequiresFeature(MembershipFeature.DIRECTORY_LISTING)
  @ApiBearerAuth()
  createBusiness(@CurrentUser() user: TokenPayload, @Body() dto: CreateBusinessListingDto) {
    return this.directoryService.createBusiness(user, dto);
  }

  @Put('businesses/:id')
  @RequiresFeature(MembershipFeature.DIRECTORY_LISTING)
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
  @ApiBearerAuth()
  deleteBusiness(@CurrentUser() user: TokenPayload, @Param('id') id: string) {
    return this.directoryService.deleteBusiness(user, id);
  }

  @Post('businesses/:id/promote')
  @RequiresFeature(MembershipFeature.DIRECTORY_PROMOTE)
  @ApiBearerAuth()
  promoteBusiness(@CurrentUser() user: TokenPayload, @Param('id') id: string) {
    return this.directoryService.createPromotionCheckout(user, id);
  }

  @Post('businesses/:id/summarise')
  @RequiresFeature(MembershipFeature.DIRECTORY_LISTING)
  @ApiBearerAuth()
  summariseBusiness(@CurrentUser() _user: TokenPayload, @Param('id') id: string) {
    return this.directoryService.summariseBusiness(id);
  }

  @Get('jobs')
  @Public()
  listJobs(@Query('businessListingId') businessListingId?: string) {
    return this.directoryService.findJobs(businessListingId);
  }

  @Post('jobs')
  @RequiresFeature(MembershipFeature.DIRECTORY_LISTING)
  @ApiBearerAuth()
  createJob(@CurrentUser() user: TokenPayload, @Body() dto: CreateJobAdDto) {
    return this.directoryService.createJob(user, dto);
  }

  @Post('jobs/:id/publish')
  @RequiresFeature(MembershipFeature.DIRECTORY_LISTING)
  @ApiBearerAuth()
  publishJob(@CurrentUser() user: TokenPayload, @Param('id') id: string) {
    return this.directoryService.createJobPublishCheckout(user, id);
  }

  @Put('jobs/:id')
  @RequiresFeature(MembershipFeature.DIRECTORY_LISTING)
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
  @ApiBearerAuth()
  deleteJob(@CurrentUser() user: TokenPayload, @Param('id') id: string) {
    return this.directoryService.deleteJob(user, id);
  }

  @Post('webhook')
  @Public()
  async webhook(
    @Headers('stripe-signature') signature: string,
    @RawBody() rawBody: Buffer,
    @Body() body: Record<string, unknown>,
    @Res() res: Response
  ) {
    try {
      if (signature) {
        const event = await this.paymentsService.constructEvent(rawBody, signature);
        if (event.type === 'checkout.session.completed') {
          await this.paymentsService.handleDirectoryPromotion(event.data.object as unknown as Record<string, unknown>);
        }
        return res.json({ received: true });
      }

      if (body?.event_type) {
        const metadata = this.paymentsService.extractPayPalMetadata(body);
        if (metadata.type === 'directory_promotion') {
          await this.directoryService.handlePromotionCompleted(metadata);
        }
        if (metadata.type === 'job_publish') {
          await this.directoryService.handleJobPublishCompleted(metadata);
        }
        return res.json({ received: true });
      }

      return res.status(400).send('Webhook payload not recognised');
    } catch (err) {
      return res.status(400).send(`Webhook error: ${(err as Error).message}`);
    }
  }
}
