import { Body, Controller, Get, Put } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { HeroConfigService } from './hero-config.service.js';
import { RequirePermission } from '../common/decorators/require-permission.decorator.js';
import { Permission } from '@kentslsc/shared';
import { Public } from '../common/decorators/public.decorator.js';

@ApiTags('Hero Config')
@Controller('hero-config')
export class HeroConfigController {
  constructor(private readonly heroConfigService: HeroConfigService) {}

  @Public()
  @Get()
  get() {
    return this.heroConfigService.get();
  }

  @Put()
  @RequirePermission(Permission.MANAGE_HERO)
  @ApiBearerAuth()
  update(@Body() dto: {
    mediaType?: string;
    imageUrl?: string;
    videoUrl?: string;
    overlayStyle?: string;
    overlayOpacity?: number;
    videoOverlayOpacity?: number;
    videoPlaybackRate?: number;
  }) {
    return this.heroConfigService.update(dto);
  }
}
