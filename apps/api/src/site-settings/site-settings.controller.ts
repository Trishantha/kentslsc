import { Body, Controller, Get, Put } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { SiteSettingsService, type SiteSettingsDto } from './site-settings.service.js';
import { Roles } from '../common/decorators/roles.decorator.js';
import { UserRole } from '@kentslsc/shared';
import { Public } from '../common/decorators/public.decorator.js';

@ApiTags('Site Settings')
@Controller('site-settings')
export class SiteSettingsController {
  constructor(private readonly siteSettingsService: SiteSettingsService) {}

  @Public()
  @Get()
  get() {
    return this.siteSettingsService.get();
  }

  @Put()
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth()
  update(@Body() dto: SiteSettingsDto) {
    return this.siteSettingsService.update(dto);
  }
}
