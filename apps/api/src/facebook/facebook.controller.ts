import { Controller, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { RequirePermission } from '../common/decorators/require-permission.decorator.js';
import { Permission } from '@kentslsc/shared';
import { FacebookService } from './facebook.service.js';

@ApiTags('Facebook')
@Controller('facebook')
export class FacebookController {
  constructor(private readonly facebookService: FacebookService) {}

  @Post('sync')
  @RequirePermission(Permission.MANAGE_BLOG)
  @ApiBearerAuth()
  async sync() {
    return this.facebookService.sync();
  }
}
