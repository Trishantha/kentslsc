import { Body, Controller, Get, Param, Post, Put, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { RequirePermission } from '../common/decorators/require-permission.decorator.js';
import { Public } from '../common/decorators/public.decorator.js';
import { OptionalAuthRoute } from '../common/decorators/optional-auth-route.decorator.js';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import { Permission, type TokenPayload } from '@kentslsc/shared';
import { PaymentSourceType, PaymentStatus } from '@kentslsc/database';
import { PaymentsService } from './payments.service.js';
import { RefundsService } from './refunds.service.js';
import { PaymentReportsService } from './reports.service.js';
import { UpdatePaymentSettingsDto } from './dto/update-payment-settings.dto.js';
import { RefundPaymentDto } from './dto/refund-payment.dto.js';

@ApiTags('Payments')
@Controller('payments')
export class PaymentsController {
  constructor(
    private readonly paymentsService: PaymentsService,
    private readonly refundsService: RefundsService,
    private readonly reportsService: PaymentReportsService
  ) {}

  private parseReportDate(value?: string, endOfDay = false): Date | undefined {
    if (!value) return undefined;
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return undefined;
    if (endOfDay && /^\d{4}-\d{2}-\d{2}$/.test(value)) date.setUTCHours(23, 59, 59, 999);
    return date;
  }

  @Get('settings')
  @RequirePermission(Permission.MANAGE_PAYMENTS)
  @ApiBearerAuth()
  async getSettings() {
    return this.paymentsService.getSettings();
  }

  @Get('stripe-config')
  @Public()
  async getStripeConfig() {
    const publishableKey = await this.paymentsService.getStripePublishableKey();
    return { publishableKey };
  }

  @Get('public-settings')
  @Public()
  async getPublicSettings() {
    return this.paymentsService.getPublicPaymentSettings();
  }

  @Get('checkout-session/:sessionId')
  @Public()
  @OptionalAuthRoute()
  @ApiBearerAuth()
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  async getCheckoutSession(
    @Param('sessionId') sessionId: string,
    @CurrentUser() user?: TokenPayload
  ) {
    return this.paymentsService.getCheckoutSession(sessionId, user?.sub);
  }

  @Get('payment-intent/:paymentIntentId')
  @Public()
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  async getPaymentIntent(
    @Param('paymentIntentId') paymentIntentId: string,
    @Query('client_secret') clientSecret?: string
  ) {
    return this.paymentsService.getPaymentIntentDetail(paymentIntentId, clientSecret);
  }

  @Put('settings')
  @RequirePermission(Permission.MANAGE_PAYMENTS)
  @ApiBearerAuth()
  async updateSettings(@Body() dto: UpdatePaymentSettingsDto) {
    return this.paymentsService.updateSettings(dto);
  }

  @Post(':id/refund')
  @RequirePermission(Permission.MANAGE_PAYMENTS)
  @ApiBearerAuth()
  async refundPayment(@Param('id') id: string, @Body() dto: RefundPaymentDto) {
    return this.refundsService.refundPayment(id, dto);
  }

  @Get('my')
  @ApiBearerAuth()
  async myPayments(@CurrentUser() user: TokenPayload, @Query('page') page?: string, @Query('limit') limit?: string) {
    return this.paymentsService.findByUser(user.sub, Number(page) || 1, Number(limit) || 50);
  }

  @Get('reports/revenue')
  @RequirePermission(Permission.MANAGE_PAYMENTS)
  @ApiBearerAuth()
  async revenueReport(
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('sourceType') sourceType?: string,
    @Query('channel') channel?: string,
    @Query('status') status?: string,
    @Query('search') search?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string
  ) {
    return this.reportsService.getRevenueReport({
      from: this.parseReportDate(from),
      to: this.parseReportDate(to, true),
      sourceType: sourceType as PaymentSourceType,
      channel,
      status: status as PaymentStatus,
      search,
      page: Number(page) || 1,
      limit: Number(limit) || 50
    });
  }

  @Get('reports/export')
  @RequirePermission(Permission.MANAGE_PAYMENTS)
  @ApiBearerAuth()
  async exportRevenue(
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('sourceType') sourceType?: string,
    @Query('channel') channel?: string,
    @Query('status') status?: string,
    @Query('search') search?: string
  ) {
    return this.reportsService.getAllForExport({
      from: this.parseReportDate(from),
      to: this.parseReportDate(to, true),
      sourceType: sourceType as PaymentSourceType,
      channel,
      status: status as PaymentStatus,
      search
    });
  }

  @Post('reports/sync-stripe')
  @RequirePermission(Permission.MANAGE_PAYMENTS)
  @ApiBearerAuth()
  async syncStripeRevenue(
    @Body('from') from?: string,
    @Body('to') to?: string
  ) {
    return this.paymentsService.syncStripeRevenue({
      from: from ? new Date(from) : undefined,
      to: to ? new Date(to) : undefined
    });
  }
}
