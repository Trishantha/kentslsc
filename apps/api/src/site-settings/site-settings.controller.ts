import { Body, Controller, Get, Put } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { SiteSettingsService } from './site-settings.service.js';
import { UpdateSiteSettingsDto } from './dto/update-site-settings.dto.js';
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
  update(@Body() dto: UpdateSiteSettingsDto) {
    return this.siteSettingsService.update(dto);
  }
}
