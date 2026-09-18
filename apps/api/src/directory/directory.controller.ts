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
import Stripe from 'stripe';
import { DirectoryService } from './directory.service.js';
import { PaymentsService } from '../payments/payments.service.js';
import { CreateBusinessListingDto } from './dto/create-business.dto.js';
import { UpdateBusinessListingDto } from './dto/update-business.dto.js';
import { CreateJobAdDto } from './dto/create-job.dto.js';
import { UpdateJobAdDto } from './dto/update-job.dto.js';
import { CheckoutPaymentSchemeDto } from './dto/checkout-payment-scheme.dto.js';
import { Public } from '../common/decorators/public.decorator.js';
import { PublicCache } from '../common/decorators/public-cache.decorator.js';

@ApiTags('Directory')
@Controller('directory')
export class DirectoryController {
  constructor(
    private readonly directoryService: DirectoryService,
    private readonly paymentsService: PaymentsService
  ) {}

  @Get('businesses')
  @Public()
  @PublicCache()
  listBusinesses(
    @Query('search') search?: string,
    @Query('category') category?: string,
    @Query('promoted') promoted?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string
  ) {
    return this.directoryService.findBusinesses(
      search,
      category,
      promoted === 'true',
      Number(page) || 1,
      Number(limit) || 50
    );
  }

  @Get('businesses/:id')
  @Public()
  @PublicCache()
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
  promoteBusiness(
    @CurrentUser() user: TokenPayload,
    @Param('id') id: string,
    @Body() dto: CheckoutPaymentSchemeDto
  ) {
    return this.directoryService.createPromotionCheckout(user, id, dto);
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
  publishJob(
    @CurrentUser() user: TokenPayload,
    @Param('id') id: string,
    @Body() dto: CheckoutPaymentSchemeDto
  ) {
    return this.directoryService.createJobPublishCheckout(user, id, dto);
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
    @Headers() headers: Record<string, string | string[] | undefined>,
    @RawBody() rawBody: Buffer,
    @Body() body: any,
    @Res() res: Response
  ) {
    try {
      if (signature) {
        const event = await this.paymentsService.constructEvent(rawBody, signature);
        if (event.type === 'checkout.session.completed') {
          const session = event.data.object as Stripe.Checkout.Session;
          await this.directoryService.handlePromotionCompleted(session.metadata ?? {}, 'stripe', {
            providerCheckoutId: session.id,
            providerPaymentId:
              typeof session.payment_intent === 'string'
                ? session.payment_intent
                : session.payment_intent?.id ?? null,
            amountPence: session.amount_total ?? undefined,
            currency: session.currency ?? 'gbp',
            payerEmail: session.customer_email ?? session.customer_details?.email ?? null,
            payerName: session.customer_details?.name ?? null,
            payerPhone: session.customer_details?.phone ?? null,
            purchasedAt: session.created ? new Date(session.created * 1000) : new Date()
          });
        }
        return res.json({ received: true });
      }

      if (body?.event_type) {
        await this.paymentsService.verifyPayPalWebhook(rawBody, headers);
        const metadata = this.paymentsService.extractPayPalMetadata(body);
        const purchaseUnit = body?.resource?.purchase_units?.[0];
        const payer = body?.resource?.payer;
        const paymentContext = {
          providerCheckoutId: body?.resource?.id ?? null,
          providerPaymentId: this.paymentsService.extractPayPalPaymentId(body),
          amountPence: purchaseUnit?.amount?.value
            ? Math.round(Number(purchaseUnit.amount.value) * 100)
            : undefined,
          currency: purchaseUnit?.amount?.currency_code ?? 'GBP',
          payerEmail: payer?.email_address ?? null,
          payerName: payer?.name
            ? `${payer.name.given_name ?? ''} ${payer.name.surname ?? ''}`.trim()
            : null,
          payerPhone: payer?.phone?.phone_number?.national_number ?? null,
          purchasedAt: body?.resource?.create_time ? new Date(body.resource.create_time) : new Date()
        };
        if (metadata.type === 'directory_promotion') {
          await this.directoryService.handlePromotionCompleted(metadata, 'paypal', paymentContext);
        }
        if (metadata.type === 'job_publish') {
          await this.directoryService.handleJobPublishCompleted(metadata, paymentContext);
        }
        return res.json({ received: true });
      }

      return res.status(400).send('Webhook payload not recognised');
    } catch {
      return res.status(400).send('Webhook processing failed');
    }
  }
}
