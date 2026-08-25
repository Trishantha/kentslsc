import { Body, Controller, Delete, Get, Param, Post, Put } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { GalleryService } from './gallery.service.js';
import { Public } from '../common/decorators/public.decorator.js';
import { RequirePermission } from '../common/decorators/require-permission.decorator.js';
import { Permission } from '@kentslsc/shared';
import { CreateGalleryDto } from './dto/create-gallery.dto.js';
import { UpdateGalleryDto } from './dto/update-gallery.dto.js';

@ApiTags('Galleries')
@Controller('galleries')
export class GalleryController {
  constructor(private readonly galleryService: GalleryService) {}

  @Get()
  @Public()
  list() {
    return this.galleryService.listPublished();
  }

  @Get(':slug')
  @Public()
  findOne(@Param('slug') slug: string) {
    return this.galleryService.findBySlug(slug);
  }

  @Get('admin/all')
  @RequirePermission(Permission.MANAGE_BLOG)
  @ApiBearerAuth()
  listAdmin() {
    return this.galleryService.listAdmin();
  }

  @Get('admin/:id')
  @RequirePermission(Permission.MANAGE_BLOG)
  @ApiBearerAuth()
  findAdminOne(@Param('id') id: string) {
    return this.galleryService.findAdminById(id);
  }

  @Post('admin')
  @RequirePermission(Permission.MANAGE_BLOG)
  @ApiBearerAuth()
  create(@Body() dto: CreateGalleryDto) {
    return this.galleryService.create(dto);
  }

  @Put('admin/:id')
  @RequirePermission(Permission.MANAGE_BLOG)
  @ApiBearerAuth()
  update(@Param('id') id: string, @Body() dto: UpdateGalleryDto) {
    return this.galleryService.update(id, dto);
  }

  @Delete('admin/:id')
  @RequirePermission(Permission.MANAGE_BLOG)
  @ApiBearerAuth()
  remove(@Param('id') id: string) {
    return this.galleryService.remove(id);
  }
}
