import { Body, Controller, Get, Put } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { RequirePermission } from '../common/decorators/require-permission.decorator.js';
import { Permission } from '@kentslsc/shared';
import { PaymentsService } from './payments.service.js';
import { UpdatePaymentSettingsDto } from './dto/update-payment-settings.dto.js';

@ApiTags('Payments')
@Controller('payments')
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  @Get('settings')
  @RequirePermission(Permission.MANAGE_PAYMENTS)
  @ApiBearerAuth()
  async getSettings() {
    return this.paymentsService.getSettings();
  }

  @Put('settings')
  @RequirePermission(Permission.MANAGE_PAYMENTS)
  @ApiBearerAuth()
  async updateSettings(@Body() dto: UpdatePaymentSettingsDto) {
    return this.paymentsService.updateSettings(dto);
  }
}
