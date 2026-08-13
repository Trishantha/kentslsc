import { Module } from '@nestjs/common';
import { SiteSettingsController } from './site-settings.controller.js';
import { SiteSettingsService } from './site-settings.service.js';

@Module({
  controllers: [SiteSettingsController],
  providers: [SiteSettingsService]
})
export class SiteSettingsModule {}
