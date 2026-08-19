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
import { FundraisingService } from './fundraising.service.js';
import { PaymentsService } from '../payments/payments.service.js';
import { RequirePermission } from '../common/decorators/require-permission.decorator.js';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import { OptionalAuth } from '../common/decorators/optional-auth.decorator.js';
import { Permission, type TokenPayload } from '@kentslsc/shared';
import { CreateFundraiserDto } from './dto/create-fundraiser.dto.js';
import { UpdateFundraiserDto } from './dto/update-fundraiser.dto.js';
import { CreateDonationDto } from './dto/create-donation.dto.js';
import { CreateFundraiserUpdateDto } from './dto/create-fundraiser-update.dto.js';
import type Stripe from 'stripe';
import { Public } from '../common/decorators/public.decorator.js';

@ApiTags('Fundraising')
@Controller('fundraisers')
export class FundraisingController {
  constructor(
    private readonly fundraisingService: FundraisingService,
    private readonly paymentsService: PaymentsService
  ) {}

  @Get()
  @Public()
  list(
    @Query('category') category?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string
  ) {
    return this.fundraisingService.listActive(category, Number(page) || 1, Number(limit) || 20);
  }

  @Get('my')
  @ApiBearerAuth()
  myCampaigns(@CurrentUser() user: TokenPayload) {
    return this.fundraisingService.listByOrganizer(user.sub);
  }

  @Get(':id')
  @Public()
  findOne(@Param('id') id: string) {
    return this.fundraisingService.findById(id);
  }

  @Get(':id/donations')
  @Public()
  getDonations(
    @Param('id') id: string,
    @Query('sort') sort?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string
  ) {
    const sortBy = sort === 'top' ? 'top' : 'recent';
    return this.fundraisingService.getDonations(id, Number(page) || 1, Number(limit) || 20, sortBy);
  }

  @Get(':id/updates')
  @Public()
  getUpdates(@Param('id') id: string) {
    return this.fundraisingService.getUpdates(id);
  }

  @Post()
  @ApiBearerAuth()
  create(@Body() dto: CreateFundraiserDto, @CurrentUser() user: TokenPayload) {
    return this.fundraisingService.create(dto, user.sub);
  }

  @Post(':id/updates')
  @ApiBearerAuth()
  addUpdate(
    @Param('id') id: string,
    @Body() dto: CreateFundraiserUpdateDto,
    @CurrentUser() user: TokenPayload
  ) {
    return this.fundraisingService.addUpdate(id, user.sub, dto);
  }

  @Put(':id')
  @RequirePermission(Permission.MANAGE_FUNDRAISERS)
  @ApiBearerAuth()
  update(@Param('id') id: string, @Body() dto: UpdateFundraiserDto) {
    return this.fundraisingService.update(id, dto);
  }

  @Delete(':id')
  @RequirePermission(Permission.MANAGE_FUNDRAISERS)
  @ApiBearerAuth()
  remove(@Param('id') id: string) {
    return this.fundraisingService.remove(id);
  }

  /** Public endpoint — Stripe collects email for guest donors */
  @Post(':id/donate')
  @Public()
  donate(
    @Param('id') id: string,
    @Body() dto: CreateDonationDto,
    @OptionalAuth() user: TokenPayload | null
  ) {
    return this.fundraisingService.createDonationSession(id, dto, user?.sub);
  }

  @Post('webhook')
  @Public()
  async webhook(
    @Headers('stripe-signature') signature: string,
    @Headers() headers: Record<string, string | string[] | undefined>,
    @RawBody() rawBody: Buffer,
    @Body() body: any,
    @Res() res: Response
  ) {
    try {
      if (signature) {
        const event = await this.paymentsService.constructEvent(rawBody, signature);
        if (event.type === 'checkout.session.completed') {
          await this.fundraisingService.handleCheckoutCompleted(
            event.data.object as Stripe.Checkout.Session
          );
        }
        return res.json({ received: true });
      }

      if (body?.event_type) {
        await this.paymentsService.verifyPayPalWebhook(rawBody, headers);
        await this.fundraisingService.handlePayPalCompleted(body);
        return res.json({ received: true });
      }

      return res.status(400).send('Webhook payload not recognised');
    } catch {
      return res.status(400).send('Webhook processing failed');
    }
  }
}
