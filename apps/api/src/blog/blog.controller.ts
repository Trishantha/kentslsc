import { Body, Controller, Delete, Get, Param, Post, Put } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { BlogService } from './blog.service.js';
import { Roles } from '../common/decorators/roles.decorator.js';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import { UserRole, type TokenPayload } from '@kentslsc/shared';
import { CreateBlogPostDto } from './dto/create-blog-post.dto.js';
import { UpdateBlogPostDto } from './dto/update-blog-post.dto.js';
import { Public } from '../common/decorators/public.decorator.js';

@ApiTags('Blog')
@Controller('blog')
export class BlogController {
  constructor(private readonly blogService: BlogService) {}

  @Get()
  @Public()
  list() {
    return this.blogService.listPublished();
  }

  @Get(':slug')
  @Public()
  findOne(@Param('slug') slug: string) {
    return this.blogService.findBySlug(slug);
  }

  @Get('admin/posts')
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth()
  listAdmin() {
    return this.blogService.listAdmin();
  }

  @Get('admin/posts/:id')
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth()
  findAdminOne(@Param('id') id: string) {
    return this.blogService.findAdminById(id);
  }

  @Post('admin/posts')
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth()
  create(@Body() dto: CreateBlogPostDto, @CurrentUser() user: TokenPayload) {
    return this.blogService.create(user.sub, dto);
  }

  @Put('admin/posts/:id')
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth()
  update(@Param('id') id: string, @Body() dto: UpdateBlogPostDto) {
    return this.blogService.update(id, dto);
  }

  @Delete('admin/posts/:id')
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth()
  remove(@Param('id') id: string) {
    return this.blogService.remove(id);
  }
}
