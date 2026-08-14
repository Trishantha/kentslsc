import { Body, Controller, Delete, Get, Param, Post, Put } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { PagesService } from './pages.service.js';
import { RequirePermission } from '../common/decorators/require-permission.decorator.js';
import { Permission } from '@kentslsc/shared';
import { Public } from '../common/decorators/public.decorator.js';
import { CreatePageDto } from './dto/create-page.dto.js';
import { UpdatePageDto } from './dto/update-page.dto.js';

@ApiTags('Pages')
@Controller('pages')
export class PagesController {
  constructor(private readonly pagesService: PagesService) {}

  @Public()
  @Get()
  listPublished() {
    return this.pagesService.listPublished();
  }

  @Public()
  @Get('home')
  getHomePage() {
    return this.pagesService.findHomePage();
  }

  @Public()
  @Get(':slug')
  getBySlug(@Param('slug') slug: string) {
    return this.pagesService.findBySlug(slug);
  }

  @Get('admin/all')
  @RequirePermission(Permission.MANAGE_PAGES)
  @ApiBearerAuth()
  listAdmin() {
    return this.pagesService.listAdmin();
  }

  @Get('admin/:id')
  @RequirePermission(Permission.MANAGE_PAGES)
  @ApiBearerAuth()
  findAdminOne(@Param('id') id: string) {
    return this.pagesService.findAdminById(id);
  }

  @Post('admin')
  @RequirePermission(Permission.MANAGE_PAGES)
  @ApiBearerAuth()
  create(@Body() dto: CreatePageDto) {
    return this.pagesService.create(dto as any);
  }

  @Put('admin/:id')
  @RequirePermission(Permission.MANAGE_PAGES)
  @ApiBearerAuth()
  update(@Param('id') id: string, @Body() dto: UpdatePageDto) {
    return this.pagesService.update(id, dto as any);
  }

  @Delete('admin/:id')
  @RequirePermission(Permission.MANAGE_PAGES)
  @ApiBearerAuth()
  remove(@Param('id') id: string) {
    return this.pagesService.remove(id);
  }
}
