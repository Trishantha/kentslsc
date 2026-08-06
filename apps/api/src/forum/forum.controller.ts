import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  UseGuards,
  HttpCode,
  HttpStatus
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { ForumService } from './forum.service.js';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard.js';
import { RolesGuard } from '../common/guards/roles.guard.js';
import { Roles } from '../common/decorators/roles.decorator.js';
import { Public } from '../common/decorators/public.decorator.js';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import { UserRole, type TokenPayload } from '@kentslsc/shared';
import { CreateCategoryDto } from './dto/create-category.dto.js';
import { UpdateCategoryDto } from './dto/update-category.dto.js';
import { CreateTopicDto } from './dto/create-topic.dto.js';
import { CreatePostDto } from './dto/create-post.dto.js';

@ApiTags('Forum')
@Controller('forum')
export class ForumController {
  constructor(private readonly forumService: ForumService) {}

  // Categories
  @Get('categories')
  @Public()
  async getCategories() {
    return this.forumService.findCategories();
  }

  @Post('categories')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth()
  async createCategory(@Body() dto: CreateCategoryDto) {
    return this.forumService.createCategory(dto);
  }

  @Patch('categories/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth()
  async updateCategory(@Param('id') id: string, @Body() dto: UpdateCategoryDto) {
    return this.forumService.updateCategory(id, dto);
  }

  @Delete('categories/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  async deleteCategory(@Param('id') id: string) {
    return this.forumService.deleteCategory(id);
  }

  // Topics
  @Get('categories/:id')
  @Public()
  async getCategory(@Param('id') id: string) {
    return this.forumService.findCategoryById(id);
  }

  @Get('categories/:id/topics')
  @Public()
  async getTopicsByCategory(@Param('id') id: string) {
    return this.forumService.findTopicsByCategory(id);
  }

  @Post('categories/:id/topics')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  async createTopic(
    @CurrentUser() user: TokenPayload,
    @Param('id') categoryId: string,
    @Body() dto: CreateTopicDto
  ) {
    return this.forumService.createTopic(user, { ...dto, categoryId });
  }

  @Get('topics/recent')
  @Public()
  async getRecentTopics() {
    return this.forumService.findLatestTopics(5);
  }

  @Get('topics/:id')
  @Public()
  async getTopic(@Param('id') id: string) {
    return this.forumService.findTopicById(id);
  }

  @Get('topics/:id/posts')
  @Public()
  async getPostsByTopic(@Param('id') id: string) {
    return this.forumService.findPostsByTopic(id);
  }

  @Post('topics/:id/posts')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  async createPost(
    @CurrentUser() user: TokenPayload,
    @Param('id') topicId: string,
    @Body() dto: CreatePostDto
  ) {
    return this.forumService.createPost(user, { ...dto, topicId });
  }

  @Delete('topics/:id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  async deleteTopic(@CurrentUser() user: TokenPayload, @Param('id') id: string) {
    return this.forumService.deleteTopic(id, user);
  }

  @Delete('posts/:id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  async deletePost(@CurrentUser() user: TokenPayload, @Param('id') id: string) {
    return this.forumService.deletePost(id, user);
  }

  @Get('topics/:id/related')
  @Public()
  async getRelatedTopics(@Param('id') id: string) {
    return this.forumService.findRelatedTopics(id);
  }
}
