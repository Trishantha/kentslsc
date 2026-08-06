import { Injectable, NotFoundException, ConflictException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../core/prisma/prisma.service.js';
import { pageBlocksSchema } from '@kentslsc/shared';
import type { SitePageInput, SitePageUpdateInput } from '@kentslsc/shared';

@Injectable()
export class PagesService {
  constructor(private readonly prisma: PrismaService) {}

  private validateBlocks(blocks: unknown[]) {
    const result = pageBlocksSchema.safeParse(blocks);
    if (!result.success) {
      throw new BadRequestException(result.error.errors.map(e => e.message).join(', '));
    }
    return result.data;
  }

  async listPublished() {
    return this.prisma.sitePage.findMany({
      where: { isPublished: true },
      select: { id: true, slug: true, title: true, isHome: true, metaDescription: true, updatedAt: true }
    });
  }

  async findBySlug(slug: string) {
    const page = await this.prisma.sitePage.findUnique({
      where: { slug }
    });
    if (!page || !page.isPublished) {
      throw new NotFoundException('Page not found');
    }
    return page;
  }

  async findHomePage() {
    const page = await this.prisma.sitePage.findFirst({
      where: { isHome: true, isPublished: true }
    });
    if (!page) {
      throw new NotFoundException('Home page not found');
    }
    return page;
  }

  async listAdmin() {
    return this.prisma.sitePage.findMany({
      orderBy: { updatedAt: 'desc' }
    });
  }

  async findAdminById(id: string) {
    const page = await this.prisma.sitePage.findUnique({ where: { id } });
    if (!page) throw new NotFoundException('Page not found');
    return page;
  }

  async create(data: SitePageInput) {
    const existing = await this.prisma.sitePage.findUnique({ where: { slug: data.slug } });
    if (existing) throw new ConflictException('A page with this slug already exists');

    const blocks = this.validateBlocks(data.blocks ?? []);

    if (data.isHome) {
      await this.clearOtherHomePages();
    }

    return this.prisma.sitePage.create({
      data: {
        slug: data.slug,
        title: data.title,
        isHome: data.isHome ?? false,
        metaDescription: data.metaDescription,
        blocks: blocks as any,
        isPublished: data.isPublished ?? false
      }
    });
  }

  async update(id: string, data: SitePageUpdateInput) {
    const existing = await this.findAdminById(id);

    if (data.slug && data.slug !== existing.slug) {
      const conflict = await this.prisma.sitePage.findUnique({ where: { slug: data.slug } });
      if (conflict) throw new ConflictException('A page with this slug already exists');
    }

    const blocks = data.blocks !== undefined ? this.validateBlocks(data.blocks) : undefined;

    if (data.isHome) {
      await this.clearOtherHomePages(id);
    }

    return this.prisma.sitePage.update({
      where: { id },
      data: {
        ...(data.title !== undefined && { title: data.title }),
        ...(data.slug !== undefined && { slug: data.slug }),
        ...(data.isHome !== undefined && { isHome: data.isHome }),
        ...(data.metaDescription !== undefined && { metaDescription: data.metaDescription }),
        ...(blocks !== undefined && { blocks: blocks as any }),
        ...(data.isPublished !== undefined && { isPublished: data.isPublished })
      }
    });
  }

  async remove(id: string) {
    await this.findAdminById(id);
    await this.prisma.sitePage.delete({ where: { id } });
    return { id, deleted: true };
  }

  private async clearOtherHomePages(excludeId?: string) {
    await this.prisma.sitePage.updateMany({
      where: { isHome: true, ...(excludeId && { id: { not: excludeId } }) },
      data: { isHome: false }
    });
  }
}
