import { Module } from '@nestjs/common';
import { HeroConfigController } from './hero-config.controller.js';
import { HeroConfigService } from './hero-config.service.js';

@Module({
  controllers: [HeroConfigController],
  providers: [HeroConfigService]
})
export class HeroConfigModule {}
