import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../core/prisma/prisma.service.js';
import { AiService } from '../ai/ai.service.js';
import type { BlogPostInput, MixedBlogListItem } from '@kentslsc/shared';

const PUBLIC_POST_INCLUDE = {
  author: { select: { id: true, name: true } },
  gallery: {
    select: {
      id: true,
      title: true,
      slug: true,
      description: true,
      photos: { orderBy: { sortOrder: 'asc' as const } }
    }
  }
} as const;

const ADMIN_POST_INCLUDE = {
  author: { select: { id: true, name: true } },
  gallery: {
    select: {
      id: true,
      title: true,
      slug: true,
      description: true,
      eventDate: true,
      isPublished: true,
      photos: { orderBy: { sortOrder: 'asc' as const } }
    }
  }
} as const;

@Injectable()
export class BlogService {
  private readonly logger = new Logger(BlogService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly ai: AiService
  ) {}

  async listPublished(page = 1, limit = 50): Promise<MixedBlogListItem[]> {
    // Fetch enough from each source to assemble the merged page: the page
    // boundary falls inside either list, so each must contribute up to
    // page * limit items before the merge sort.
    const take = page * limit;
    const [blogPosts, facebookPosts] = await Promise.all([
      this.prisma.blogPost.findMany({
        where: { isPublished: true, deletedAt: null },
        orderBy: { publishedAt: 'desc' },
        take,
        select: {
          id: true,
          title: true,
          slug: true,
          imageUrl: true,
          metaDescription: true,
          tags: true,
          aiTldr: true,
          publishedAt: true,
          createdAt: true
        }
      }),
      this.prisma.externalSocialPost.findMany({
        where: { source: 'facebook' },
        orderBy: { publishedAt: 'desc' },
        take,
        select: {
          id: true,
          title: true,
          content: true,
          imageUrl: true,
          url: true,
          publishedAt: true
        }
      })
    ]);

    const blogItems: MixedBlogListItem[] = blogPosts.map((post) => ({
      type: 'blog',
      id: post.id,
      title: post.title,
      slug: post.slug,
      imageUrl: post.imageUrl,
      metaDescription: post.metaDescription,
      tags: post.tags,
      aiTldr: post.aiTldr,
      publishedAt: post.publishedAt?.toISOString() ?? null,
      createdAt: post.createdAt.toISOString()
    }));

    const facebookItems: MixedBlogListItem[] = facebookPosts.map((post) => ({
      type: 'facebook',
      id: post.id,
      title: post.title,
      content: post.content,
      imageUrl: post.imageUrl,
      url: post.url,
      publishedAt: post.publishedAt?.toISOString() ?? null
    }));

    return [...blogItems, ...facebookItems]
      .sort((a, b) => {
        const dateA = a.publishedAt ? new Date(a.publishedAt).getTime() : 0;
        const dateB = b.publishedAt ? new Date(b.publishedAt).getTime() : 0;
        return dateB - dateA;
      })
      .slice((page - 1) * limit, page * limit);
  }

  async findBySlug(slug: string) {
    const item = await this.prisma.blogPost.findUnique({
      where: { slug, deletedAt: null },
      include: PUBLIC_POST_INCLUDE
    });
    if (!item) throw new NotFoundException('Blog post not found');
    if (!item.isPublished) throw new NotFoundException('Blog post not found');
    return item;
  }

  async listAdmin() {
    const items = await this.prisma.blogPost.findMany({
      where: { deletedAt: null },
      orderBy: { createdAt: 'desc' },
      include: ADMIN_POST_INCLUDE
    });
    return items;
  }

  async findAdminById(id: string) {
    const item = await this.prisma.blogPost.findUnique({
      where: { id, deletedAt: null },
      include: ADMIN_POST_INCLUDE
    });
    if (!item) throw new NotFoundException('Blog post not found');
    return item;
  }

  async create(authorUserId: string, data: BlogPostInput) {
    const publishedAt = data.isPublished ? (data.publishedAt ?? new Date()) : null;
    const item = await this.prisma.blogPost.create({
      data: {
        title: data.title,
        slug: data.slug,
        content: data.content,
        imageUrl: data.imageUrl,
        metaDescription: data.metaDescription,
        tags: data.tags ?? [],
        galleryId: data.galleryId || null,
        authorUserId,
        isPublished: data.isPublished ?? false,
        publishedAt,
        aiTldr: null
      },
      include: ADMIN_POST_INCLUDE
    });

    if (data.isPublished && data.content?.trim()) {
      this.refreshAiTldr(item.id, data.content).catch((error) => {
        this.logger.warn(`Failed to generate blog TLDR: ${(error as Error).message}`);
      });
    }

    return item;
  }

  async update(id: string, data: Partial<BlogPostInput>) {
    const existing = await this.findAdminById(id);
    const willPublish =
      data.isPublished === true ||
      (existing.isPublished === false &&
        data.isPublished === undefined &&
        data.publishedAt !== undefined);

    const publishedAt =
      data.isPublished === true
        ? data.publishedAt ?? existing.publishedAt ?? new Date()
        : data.publishedAt;

    const item = await this.prisma.blogPost.update({
      where: { id },
      data: {
        ...(data.title !== undefined && { title: data.title }),
        ...(data.slug !== undefined && { slug: data.slug }),
        ...(data.content !== undefined && { content: data.content }),
        ...(data.imageUrl !== undefined && { imageUrl: data.imageUrl }),
        ...(data.metaDescription !== undefined && { metaDescription: data.metaDescription }),
        ...(data.tags !== undefined && { tags: data.tags ?? [] }),
        ...(data.galleryId !== undefined && { galleryId: data.galleryId || null }),
        ...(data.isPublished !== undefined && { isPublished: data.isPublished }),
        ...(publishedAt !== undefined && { publishedAt })
      },
      include: ADMIN_POST_INCLUDE
    });

    if (willPublish || data.isPublished === true) {
      const content = data.content ?? existing.content;
      if (content?.trim()) {
        this.refreshAiTldr(id, content).catch((error) => {
          this.logger.warn(`Failed to refresh blog TLDR: ${(error as Error).message}`);
        });
      }
    }

    return item;
  }

  private async refreshAiTldr(postId: string, content: string): Promise<void> {
    const aiTldr = await this.ai.summarise(content, 'blog post', 200);
    await this.prisma.blogPost.update({
      where: { id: postId },
      data: { aiTldr: aiTldr || null }
    });
  }

  async remove(id: string) {
    await this.findAdminById(id);
    await this.prisma.blogPost.update({ where: { id }, data: { deletedAt: new Date() } });
    return { id, deleted: true };
  }
}
