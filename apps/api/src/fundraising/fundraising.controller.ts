import {
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  Param,
  Post,
  Put,
  RawBody,
  Res,
  UseGuards
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { FundraisingService } from './fundraising.service.js';
import { PaymentsService } from '../payments/payments.service.js';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard.js';
import { RolesGuard } from '../common/guards/roles.guard.js';
import { Roles } from '../common/decorators/roles.decorator.js';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import { UserRole, type TokenPayload } from '@kentslsc/shared';
import { CreateFundraiserDto } from './dto/create-fundraiser.dto.js';
import { UpdateFundraiserDto } from './dto/update-fundraiser.dto.js';
import { CreateDonationDto } from './dto/create-donation.dto.js';
import type Stripe from 'stripe';

@ApiTags('Fundraising')
@Controller('fundraisers')
export class FundraisingController {
  constructor(
    private readonly fundraisingService: FundraisingService,
    private readonly paymentsService: PaymentsService
  ) {}

  @Get()
  list() {
    return this.fundraisingService.listActive();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.fundraisingService.findById(id);
  }

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth()
  create(@Body() dto: CreateFundraiserDto) {
    return this.fundraisingService.create(dto);
  }

  @Put(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth()
  update(@Param('id') id: string, @Body() dto: UpdateFundraiserDto) {
    return this.fundraisingService.update(id, dto);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth()
  remove(@Param('id') id: string) {
    return this.fundraisingService.remove(id);
  }

  @Post(':id/donate')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  donate(
    @Param('id') id: string,
    @Body() dto: CreateDonationDto,
    @CurrentUser() user: TokenPayload
  ) {
    return this.fundraisingService.createDonationSession(id, dto.amount, user.sub);
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
        await this.fundraisingService.handleCheckoutCompleted(
          event.data.object as Stripe.Checkout.Session
        );
      }
      return res.json({ received: true });
    } catch (err) {
      return res.status(400).send(`Webhook error: ${(err as Error).message}`);
    }
  }
}
