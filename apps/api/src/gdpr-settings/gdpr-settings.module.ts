import { Module } from '@nestjs/common';
import { GdprSettingsService } from './gdpr-settings.service.js';
import { GdprSettingsController } from './gdpr-settings.controller.js';

@Module({
  controllers: [GdprSettingsController],
  providers: [GdprSettingsService],
  exports: [GdprSettingsService]
})
export class GdprSettingsModule {}
