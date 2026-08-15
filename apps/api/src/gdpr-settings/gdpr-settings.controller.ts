import { Body, Controller, Get, Put } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { GdprSettingsService } from './gdpr-settings.service.js';
import { UpdateGdprSettingsDto } from './dto/update-gdpr-settings.dto.js';
import { Roles } from '../common/decorators/roles.decorator.js';
import { UserRole } from '@kentslsc/shared';
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
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth()
  update(@Body() dto: UpdateGdprSettingsDto) {
    return this.service.update(dto);
  }
}
