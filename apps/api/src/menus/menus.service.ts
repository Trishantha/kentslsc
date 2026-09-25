import {
  BadRequestException,
  Injectable,
  NotFoundException
} from '@nestjs/common';
import { PrismaService } from '../core/prisma/prisma.service.js';
import {
  menuItemSchema,
  menuItemUpdateSchema,
  menuItemOrderSchema
} from '@kentslsc/shared';
import type {
  MenuItemNode,
  MenuItemOrderInput,
  MenuItemUpdateInput
} from '@kentslsc/shared';
import type { MenuItem, SitePage } from '@kentslsc/database';

type MenuItemWithPage = MenuItem & { page: Pick<SitePage, 'slug' | 'isPublished'> | null };

@Injectable()
export class MenusService {
  constructor(private readonly prisma: PrismaService) {}

  async getPublicTree(): Promise<MenuItemNode[]> {
    const tree = await this.buildTree(false);
    const filterVisible = (nodes: MenuItemNode[]): MenuItemNode[] =>
      nodes
        .filter((node) => node.isVisible && node.href !== null)
        .map((node) => ({ ...node, children: filterVisible(node.children) }));
    return filterVisible(tree);
  }

  async getAdminTree(): Promise<MenuItemNode[]> {
    return this.buildTree(true);
  }

  async create(raw: unknown) {
    const parsed = menuItemSchema.safeParse(raw);
    if (!parsed.success) {
      throw new BadRequestException(parsed.error.errors.map((e) => e.message).join(', '));
    }
    const dto = parsed.data;
    await this.validateLink(dto.linkType, dto.path ?? null, dto.pageId ?? null);
    if (dto.parentId) {
      await this.validateParent(dto.parentId, null);
    }
    const item = await this.prisma.menuItem.create({
      data: {
        parentId: dto.parentId ?? null,
        labelEn: dto.labelEn,
        labelSi: dto.labelSi ?? null,
        labelTa: dto.labelTa ?? null,
        linkType: dto.linkType,
        path: dto.linkType === 'path' ? dto.path ?? null : null,
        pageId: dto.linkType === 'page' ? dto.pageId ?? null : null,
        sortOrder: dto.sortOrder,
        isVisible: dto.isVisible
      },
      include: { page: { select: { slug: true, isPublished: true } } }
    });
    return this.toNode(item, true);
  }

  async update(id: string, raw: unknown) {
    const existing = await this.prisma.menuItem.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException('Menu item not found');
    }
    const parsed = menuItemUpdateSchema.safeParse(raw);
    if (!parsed.success) {
      throw new BadRequestException(parsed.error.errors.map((e) => e.message).join(', '));
    }
    const dto: MenuItemUpdateInput = parsed.data;
    if (dto.parentId !== undefined && dto.parentId) {
      await this.validateParent(dto.parentId, id);
    }
    const linkType = dto.linkType ?? (existing.linkType === 'page' ? 'page' : 'path');
    const path = dto.path !== undefined ? dto.path : existing.path;
    const pageId = dto.pageId !== undefined ? dto.pageId : existing.pageId;
    await this.validateLink(linkType, path ?? null, pageId ?? null);
    const item = await this.prisma.menuItem.update({
      where: { id },
      data: {
        parentId: dto.parentId !== undefined ? dto.parentId : undefined,
        labelEn: dto.labelEn,
        labelSi: dto.labelSi !== undefined ? dto.labelSi : undefined,
        labelTa: dto.labelTa !== undefined ? dto.labelTa : undefined,
        linkType,
        path: linkType === 'path' ? path ?? null : null,
        pageId: linkType === 'page' ? pageId ?? null : null,
        sortOrder: dto.sortOrder,
        isVisible: dto.isVisible
      },
      include: { page: { select: { slug: true, isPublished: true } } }
    });
    return this.toNode(item, true);
  }

  async remove(id: string) {
    const existing = await this.prisma.menuItem.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException('Menu item not found');
    }
    await this.prisma.menuItem.delete({ where: { id } });
    return { success: true };
  }

  async reorder(raw: unknown) {
    const parsed = menuItemOrderSchema.safeParse(raw);
    if (!parsed.success) {
      throw new BadRequestException(parsed.error.errors.map((e) => e.message).join(', '));
    }
    const entries: MenuItemOrderInput = parsed.data;
    const items = await this.prisma.menuItem.findMany({ select: { id: true } });
    const knownIds = new Set(items.map((item) => item.id));
    const entryById = new Map(entries.map((entry) => [entry.id, entry]));
    for (const entry of entries) {
      if (!knownIds.has(entry.id)) {
        throw new BadRequestException(`Menu item ${entry.id} does not exist`);
      }
      if (entry.parentId) {
        const parentEntry = entryById.get(entry.parentId);
        const parentIsTopLevel = parentEntry
          ? !parentEntry.parentId
          : (await this.prisma.menuItem.findUnique({ where: { id: entry.parentId } }))
              ?.parentId === null;
        if (!parentIsTopLevel) {
          throw new BadRequestException('Submenus cannot be nested deeper than one level');
        }
      }
    }
    await this.prisma.$transaction(
      entries.map((entry) =>
        this.prisma.menuItem.update({
          where: { id: entry.id },
          data: { parentId: entry.parentId, sortOrder: entry.sortOrder }
        })
      )
    );
    return this.getAdminTree();
  }

  private async buildTree(admin: boolean): Promise<MenuItemNode[]> {
    const items = await this.prisma.menuItem.findMany({
      include: { page: { select: { slug: true, isPublished: true } } },
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }]
    });
    const nodes = new Map<string, MenuItemNode>();
    const roots: MenuItemNode[] = [];
    for (const item of items) {
      nodes.set(item.id, this.toNode(item, admin));
    }
    for (const node of nodes.values()) {
      const parent = node.parentId ? nodes.get(node.parentId) : undefined;
      if (parent) {
        parent.children.push(node);
      } else {
        roots.push(node);
      }
    }
    return roots;
  }

  private toNode(item: MenuItemWithPage, admin: boolean): MenuItemNode {
    const linkType = item.linkType === 'page' ? 'page' : 'path';
    const pageMissing = linkType === 'page' && (!item.page || !item.page.isPublished);
    const href = linkType === 'page' ? (item.page ? `/${item.page.slug}` : null) : item.path;
    return {
      id: item.id,
      parentId: item.parentId,
      labelEn: item.labelEn,
      labelSi: item.labelSi,
      labelTa: item.labelTa,
      linkType,
      path: item.path,
      pageId: item.pageId,
      href: admin || !pageMissing ? href : null,
      ...(admin ? { pageUnpublished: pageMissing } : {}),
      sortOrder: item.sortOrder,
      isVisible: item.isVisible,
      children: []
    };
  }

  private async validateLink(linkType: 'path' | 'page', path: string | null, pageId: string | null) {
    if (linkType === 'path') {
      if (!path || !path.startsWith('/')) {
        throw new BadRequestException('Internal path must start with /');
      }
      return;
    }
    if (!pageId) {
      throw new BadRequestException('A CMS page must be selected for page links');
    }
    const page = await this.prisma.sitePage.findUnique({ where: { id: pageId } });
    if (!page) {
      throw new BadRequestException('Selected CMS page does not exist');
    }
  }

  private async validateParent(parentId: string, itemId: string | null) {
    if (itemId && parentId === itemId) {
      throw new BadRequestException('A menu item cannot be its own parent');
    }
    const parent = await this.prisma.menuItem.findUnique({ where: { id: parentId } });
    if (!parent) {
      throw new BadRequestException('Parent menu item does not exist');
    }
    if (parent.parentId) {
      throw new BadRequestException('Submenus cannot be nested deeper than one level');
    }
  }
}
