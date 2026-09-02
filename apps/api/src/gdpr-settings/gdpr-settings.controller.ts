import { Body, Controller, Get, Put } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { GdprSettingsService } from './gdpr-settings.service.js';
import { UpdateGdprSettingsDto } from './dto/update-gdpr-settings.dto.js';
import { RequirePermission } from '../common/decorators/require-permission.decorator.js';
import { Permission } from '@kentslsc/shared';
import { Public } from '../common/decorators/public.decorator.js';

@ApiTags('GDPR Settings')
@Controller('gdpr-settings')
export class GdprSettingsController {
  constructor(private readonly service: GdprSettingsService) {}

  @Public()
  @Get()
  get() {
    return this.service.get();
  }

  @Put()
  @ApiBearerAuth()
  @RequirePermission(Permission.MANAGE_GDPR_SETTINGS)
  update(@Body() dto: UpdateGdprSettingsDto) {
    return this.service.update(dto);
  }
}
