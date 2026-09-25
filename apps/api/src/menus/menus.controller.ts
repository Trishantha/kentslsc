import { Body, Controller, Delete, Get, Param, Post, Put } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { MenusService } from './menus.service.js';
import { RequirePermission } from '../common/decorators/require-permission.decorator.js';
import { Permission } from '@kentslsc/shared';
import { Public } from '../common/decorators/public.decorator.js';
import { PublicCache } from '../common/decorators/public-cache.decorator.js';
import {
  CreateMenuItemDto,
  ReorderMenuItemsDto,
  UpdateMenuItemDto
} from './dto/menu-item.dto.js';

@ApiTags('Menus')
@Controller('menus')
export class MenusController {
  constructor(private readonly menusService: MenusService) {}

  @Public()
  @PublicCache()
  @Get('public')
  getPublic() {
    return this.menusService.getPublicTree();
  }

  @Get()
  @RequirePermission(Permission.MANAGE_NAVIGATION)
  @ApiBearerAuth()
  getAdmin() {
    return this.menusService.getAdminTree();
  }

  @Post()
  @RequirePermission(Permission.MANAGE_NAVIGATION)
  @ApiBearerAuth()
  create(@Body() dto: CreateMenuItemDto) {
    return this.menusService.create(dto);
  }

  @Put('order')
  @RequirePermission(Permission.MANAGE_NAVIGATION)
  @ApiBearerAuth()
  reorder(@Body() dto: ReorderMenuItemsDto) {
    return this.menusService.reorder(dto.entries);
  }

  @Put(':id')
  @RequirePermission(Permission.MANAGE_NAVIGATION)
  @ApiBearerAuth()
  update(@Param('id') id: string, @Body() dto: UpdateMenuItemDto) {
    return this.menusService.update(id, dto);
  }

  @Delete(':id')
  @RequirePermission(Permission.MANAGE_NAVIGATION)
  @ApiBearerAuth()
  remove(@Param('id') id: string) {
    return this.menusService.remove(id);
  }
}
