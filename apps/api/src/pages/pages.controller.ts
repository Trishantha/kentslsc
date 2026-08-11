import { Body, Controller, Delete, Get, Param, Post, Put } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { PagesService } from './pages.service.js';
import { Roles } from '../common/decorators/roles.decorator.js';
import { UserRole } from '@kentslsc/shared';
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
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth()
  listAdmin() {
    return this.pagesService.listAdmin();
  }

  @Get('admin/:id')
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth()
  findAdminOne(@Param('id') id: string) {
    return this.pagesService.findAdminById(id);
  }

  @Post('admin')
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth()
  create(@Body() dto: CreatePageDto) {
    return this.pagesService.create(dto as any);
  }

  @Put('admin/:id')
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth()
  update(@Param('id') id: string, @Body() dto: UpdatePageDto) {
    return this.pagesService.update(id, dto as any);
  }

  @Delete('admin/:id')
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth()
  remove(@Param('id') id: string) {
    return this.pagesService.remove(id);
  }
}
