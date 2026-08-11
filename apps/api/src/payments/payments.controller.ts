import { Body, Controller, Get, Put } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Roles } from '../common/decorators/roles.decorator.js';
import { UserRole } from '@kentslsc/shared';
import { PaymentsService } from './payments.service.js';
import { UpdatePaymentSettingsDto } from './dto/update-payment-settings.dto.js';

@ApiTags('Payments')
@Controller('payments')
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  @Get('settings')
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth()
  async getSettings() {
    return this.paymentsService.getSettings();
  }

  @Put('settings')
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth()
  async updateSettings(@Body() dto: UpdatePaymentSettingsDto) {
    return this.paymentsService.updateSettings(dto);
  }
}
