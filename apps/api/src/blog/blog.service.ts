import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../core/prisma/prisma.service.js';
import { AiService } from '../ai/ai.service.js';
import type { BlogPostInput } from '@kentslsc/shared';

@Injectable()
export class BlogService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ai: AiService
  ) {}

  async listPublished() {
    const items = await this.prisma.blogPost.findMany({
      where: { isPublished: true, deletedAt: null },
      orderBy: { publishedAt: 'desc' },
      select: {
        id: true,
        title: true,
        slug: true,
        imageUrl: true,
        aiTldr: true,
        publishedAt: true,
        createdAt: true
      }
    });
    return items;
  }

  async findBySlug(slug: string) {
    const item = await this.prisma.blogPost.findUnique({
      where: { slug, deletedAt: null },
      include: { author: { select: { id: true, name: true } } }
    });
    if (!item) throw new NotFoundException('Blog post not found');
    if (!item.isPublished) throw new NotFoundException('Blog post not found');
    return item;
  }

  async listAdmin() {
    const items = await this.prisma.blogPost.findMany({
      where: { deletedAt: null },
      orderBy: { createdAt: 'desc' },
      include: { author: { select: { id: true, name: true } } }
    });
    return items;
  }

  async findAdminById(id: string) {
    const item = await this.prisma.blogPost.findUnique({
      where: { id, deletedAt: null },
      include: { author: { select: { id: true, name: true } } }
    });
    if (!item) throw new NotFoundException('Blog post not found');
    return item;
  }

  async create(authorUserId: string, data: BlogPostInput) {
    const publishedAt = data.isPublished ? (data.publishedAt ?? new Date()) : null;
    const aiTldr =
      data.isPublished && data.content
        ? await this.ai.summarise(data.content, 'blog post', 200)
        : null;
    const item = await this.prisma.blogPost.create({
      data: {
        title: data.title,
        slug: data.slug,
        content: data.content,
        imageUrl: data.imageUrl,
        authorUserId,
        isPublished: data.isPublished ?? false,
        publishedAt,
        aiTldr
      },
      include: { author: { select: { id: true, name: true } } }
    });
    return item;
  }

  async update(id: string, data: Partial<BlogPostInput>) {
    const existing = await this.findAdminById(id);
    const willPublish =
      data.isPublished === true ||
      (existing.isPublished === false &&
        data.isPublished === undefined &&
        data.publishedAt !== undefined);

    let aiTldr: string | undefined;
    if (willPublish || data.isPublished === true) {
      const content = data.content ?? existing.content;
      if (content) {
        aiTldr = await this.ai.summarise(content, 'blog post', 200);
      }
    }

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
        ...(data.isPublished !== undefined && { isPublished: data.isPublished }),
        ...(publishedAt !== undefined && { publishedAt }),
        ...(aiTldr !== undefined && { aiTldr })
      },
      include: { author: { select: { id: true, name: true } } }
    });
    return item;
  }

  async remove(id: string) {
    await this.findAdminById(id);
    await this.prisma.blogPost.update({ where: { id }, data: { deletedAt: new Date() } });
    return { id, deleted: true };
  }
}
