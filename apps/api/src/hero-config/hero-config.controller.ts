import { Body, Controller, Get, Put, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { HeroConfigService } from './hero-config.service.js';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard.js';
import { RolesGuard } from '../common/guards/roles.guard.js';
import { Roles } from '../common/decorators/roles.decorator.js';
import { UserRole } from '@kentslsc/shared';
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
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
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
