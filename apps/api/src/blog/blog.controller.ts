import { Body, Controller, Delete, Get, Param, Post, Put, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { BlogService } from './blog.service.js';
import { RequirePermission } from '../common/decorators/require-permission.decorator.js';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import { Permission, type TokenPayload } from '@kentslsc/shared';
import { CreateBlogPostDto } from './dto/create-blog-post.dto.js';
import { UpdateBlogPostDto } from './dto/update-blog-post.dto.js';
import { Public } from '../common/decorators/public.decorator.js';
import { PublicCache } from '../common/decorators/public-cache.decorator.js';

@ApiTags('Blog')
@Controller('blog')
export class BlogController {
  constructor(private readonly blogService: BlogService) {}

  @Get()
  @Public()
  @PublicCache()
  list(@Query('page') page?: string, @Query('limit') limit?: string) {
    return this.blogService.listPublished(Number(page) || 1, Number(limit) || 50);
  }

  @Get(':slug')
  @Public()
  @PublicCache()
  findOne(@Param('slug') slug: string) {
    return this.blogService.findBySlug(slug);
  }

  @Get('admin/posts')
  @RequirePermission(Permission.MANAGE_BLOG)
  @ApiBearerAuth()
  listAdmin() {
    return this.blogService.listAdmin();
  }

  @Get('admin/posts/:id')
  @RequirePermission(Permission.MANAGE_BLOG)
  @ApiBearerAuth()
  findAdminOne(@Param('id') id: string) {
    return this.blogService.findAdminById(id);
  }

  @Post('admin/posts')
  @RequirePermission(Permission.MANAGE_BLOG)
  @ApiBearerAuth()
  create(@Body() dto: CreateBlogPostDto, @CurrentUser() user: TokenPayload) {
    return this.blogService.create(user.sub, dto);
  }

  @Put('admin/posts/:id')
  @RequirePermission(Permission.MANAGE_BLOG)
  @ApiBearerAuth()
  update(@Param('id') id: string, @Body() dto: UpdateBlogPostDto) {
    return this.blogService.update(id, dto);
  }

  @Delete('admin/posts/:id')
  @RequirePermission(Permission.MANAGE_BLOG)
  @ApiBearerAuth()
  remove(@Param('id') id: string) {
    return this.blogService.remove(id);
  }
}
