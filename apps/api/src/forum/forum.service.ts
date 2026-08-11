import { Injectable, NotFoundException, ForbiddenException, Logger } from '@nestjs/common';
import { PrismaService } from '../core/prisma/prisma.service.js';
import { AiService } from '../ai/ai.service.js';
import { UserRole, type TokenPayload } from '@kentslsc/shared';
import type { CreateCategoryDto } from './dto/create-category.dto.js';
import type { UpdateCategoryDto } from './dto/update-category.dto.js';
import type { CreateTopicDto } from './dto/create-topic.dto.js';
import type { CreatePostDto } from './dto/create-post.dto.js';

@Injectable()
export class ForumService {
  private readonly logger = new Logger(ForumService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly aiService: AiService
  ) {}

  // Categories
  async findCategories() {
    return this.prisma.forumCategory.findMany({
      where: { deletedAt: null },
      orderBy: { name: 'asc' }
    });
  }

  async findCategoryById(id: string) {
    const category = await this.prisma.forumCategory.findUnique({
      where: { id, deletedAt: null }
    });
    if (!category) throw new NotFoundException('Category not found');
    return category;
  }

  async createCategory(dto: CreateCategoryDto) {
    return this.prisma.forumCategory.create({
      data: {
        name: dto.name,
        description: dto.description ?? null
      }
    });
  }

  async updateCategory(id: string, dto: UpdateCategoryDto) {
    await this.findCategoryById(id);
    return this.prisma.forumCategory.update({
      where: { id },
      data: {
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.description !== undefined && { description: dto.description ?? null })
      }
    });
  }

  async deleteCategory(id: string) {
    await this.findCategoryById(id);
    return this.prisma.forumCategory.update({
      where: { id },
      data: { deletedAt: new Date() }
    });
  }

  // Topics
  async findTopicsByCategory(categoryId: string) {
    await this.findCategoryById(categoryId);
    return this.prisma.forumTopic.findMany({
      where: { categoryId, deletedAt: null },
      orderBy: { createdAt: 'desc' },
      include: {
        user: { select: { id: true, name: true } },
        _count: { select: { posts: { where: { deletedAt: null } } } }
      }
    });
  }

  async findTopicById(id: string) {
    const topic = await this.prisma.forumTopic.findUnique({
      where: { id, deletedAt: null },
      include: {
        category: true,
        user: { select: { id: true, name: true } }
      }
    });
    if (!topic) throw new NotFoundException('Topic not found');
    return topic;
  }

  async createTopic(user: TokenPayload, dto: CreateTopicDto) {
    await this.findCategoryById(dto.categoryId);

    const moderation = await this.aiService.moderate(`${dto.title} ${dto.content}`);

    const topic = await this.prisma.forumTopic.create({
      data: {
        categoryId: dto.categoryId,
        userId: user.sub,
        title: dto.title,
        content: dto.content,
        isFlagged: moderation.flagged,
        aiSummary: null,
        tags: []
      },
      include: {
        user: { select: { id: true, name: true } },
        _count: { select: { posts: { where: { deletedAt: null } } } }
      }
    });

    this.enrichTopicMetadata(topic.id, dto.title, dto.content).catch((err) => {
      this.logger.warn(`Failed to enrich forum topic metadata: ${(err as Error).message}`);
    });

    return { ...topic, moderation: moderation.flagged ? moderation : undefined };
  }

  async deleteTopic(id: string, user: TokenPayload) {
    const topic = await this.findTopicById(id);
    if (topic.userId !== user.sub && user.role !== UserRole.ADMIN) {
      throw new ForbiddenException('Only the author or an admin can delete this topic');
    }
    return this.prisma.forumTopic.update({
      where: { id },
      data: { deletedAt: new Date() }
    });
  }

  // Posts
  async findPostsByTopic(topicId: string) {
    await this.findTopicById(topicId);
    return this.prisma.forumPost.findMany({
      where: { topicId, deletedAt: null },
      orderBy: { createdAt: 'asc' },
      include: {
        user: { select: { id: true, name: true } }
      }
    });
  }

  async createPost(user: TokenPayload, dto: CreatePostDto) {
    await this.findTopicById(dto.topicId);

    const moderation = await this.aiService.moderate(dto.content);

    const post = await this.prisma.forumPost.create({
      data: {
        topicId: dto.topicId,
        userId: user.sub,
        content: dto.content,
        isFlagged: moderation.flagged
      },
      include: {
        user: { select: { id: true, name: true } }
      }
    });

    return { post, moderation: moderation.flagged ? moderation : undefined };
  }

  async deletePost(id: string, user: TokenPayload) {
    const post = await this.prisma.forumPost.findUnique({
      where: { id, deletedAt: null },
      include: { user: { select: { id: true } } }
    });
    if (!post) throw new NotFoundException('Post not found');
    if (post.userId !== user.sub && user.role !== UserRole.ADMIN) {
      throw new ForbiddenException('Only the author or an admin can delete this post');
    }
    return this.prisma.forumPost.update({
      where: { id },
      data: { deletedAt: new Date() }
    });
  }

  // AI helpers
  private async suggestTags(title: string, content: string): Promise<string[]> {
    try {
      const prompt = `Suggest up to 5 concise tags for this forum topic. Return only a comma-separated list.\n\nTitle: ${title}\nContent: ${content.slice(0, 2000)}`;
      const result = await this.aiService.summarise(prompt, 'tags', 100);
      return result
        .split(',')
        .map((tag) => tag.trim().toLowerCase())
        .filter((tag) => tag.length > 0 && tag.length <= 30)
        .slice(0, 5);
    } catch (err) {
      this.logger.warn('Failed to suggest tags', (err as Error).message);
      return [];
    }
  }

  private async enrichTopicMetadata(topicId: string, title: string, content: string): Promise<void> {
    const [summary, tags] = await Promise.all([
      this.aiService.summarise(content, 'forum topic', 200),
      this.suggestTags(title, content)
    ]);

    await this.prisma.forumTopic.update({
      where: { id: topicId },
      data: {
        aiSummary: summary || null,
        tags
      }
    });
  }

  async findRelatedTopics(topicId: string, limit = 5) {
    const topic = await this.findTopicById(topicId);
    if (!topic.tags.length) return [];

    const related = await this.prisma.forumTopic.findMany({
      where: {
        id: { not: topicId },
        deletedAt: null,
        OR: [
          { tags: { hasSome: topic.tags } },
          { title: { contains: topic.title.split(' ').slice(0, 3).join(' '), mode: 'insensitive' } }
        ]
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
      include: {
        user: { select: { id: true, name: true } },
        _count: { select: { posts: { where: { deletedAt: null } } } }
      }
    });

    return related;
  }

  async findLatestTopics(limit = 5) {
    return this.prisma.forumTopic.findMany({
      where: { deletedAt: null },
      orderBy: { createdAt: 'desc' },
      take: limit,
      include: {
        user: { select: { id: true, name: true } },
        category: { select: { id: true, name: true } },
        _count: { select: { posts: { where: { deletedAt: null } } } }
      }
    });
  }
}
