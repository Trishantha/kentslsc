import { jest, describe, it, expect, beforeEach } from '@jest/globals';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { MenusService } from './menus.service.js';
import type { PrismaService } from '../core/prisma/prisma.service.js';

const A = 'aaaaaaaa-0000-4000-8000-00000000000a';
const B = 'bbbbbbbb-0000-4000-8000-00000000000b';
const C = 'cccccccc-0000-4000-8000-00000000000c';
const GHOST = 'eeeeeeee-0000-4000-8000-00000000000e';
const PAGE = 'ffffffff-0000-4000-8000-00000000000f';

function menuItem(overrides: Record<string, unknown> = {}) {
  return {
    id: A,
    parentId: null,
    labelEn: 'Events',
    labelSi: null,
    labelTa: null,
    linkType: 'path',
    path: '/events',
    pageId: null,
    page: null,
    sortOrder: 0,
    isVisible: true,
    createdAt: new Date('2026-09-25T00:00:00Z'),
    updatedAt: new Date('2026-09-25T00:00:00Z'),
    ...overrides
  };
}

describe('MenusService', () => {
  let service: MenusService;
  let prisma: {
    menuItem: Record<string, jest.Mock>;
    sitePage: Record<string, jest.Mock>;
    $transaction: jest.Mock;
  };

  beforeEach(() => {
    prisma = {
      menuItem: {
        findMany: jest.fn(() => Promise.resolve([])),
        findUnique: jest.fn(() => Promise.resolve(null)),
        create: jest.fn((args: { data: Record<string, unknown> }) =>
          Promise.resolve(menuItem(args.data))
        ),
        update: jest.fn(() => Promise.resolve(menuItem())),
        delete: jest.fn(() => Promise.resolve(menuItem()))
      },
      sitePage: {
        findUnique: jest.fn(() => Promise.resolve(null))
      },
      $transaction: jest.fn(() => Promise.resolve([]))
    };
    service = new MenusService(prisma as unknown as PrismaService);
  });

  describe('getPublicTree', () => {
    it('returns visible items nested under visible parents with resolved hrefs', async () => {
      prisma.menuItem.findMany.mockResolvedValue([
        menuItem({ id: A, path: '/events', sortOrder: 0 }),
        menuItem({
          id: B,
          parentId: A,
          labelEn: 'Calendar',
          path: '/events/calendar',
          sortOrder: 0
        }),
        menuItem({ id: C, path: '/hidden', isVisible: false, sortOrder: 1 }),
        menuItem({
          id: GHOST,
          labelEn: 'Secret',
          path: '/secret',
          parentId: A,
          isVisible: false,
          sortOrder: 1
        }),
        menuItem({
          id: PAGE,
          labelEn: 'About us',
          linkType: 'page',
          path: null,
          pageId: PAGE,
          page: { slug: 'about', isPublished: true },
          sortOrder: 2
        })
      ]);

      const tree = await service.getPublicTree();

      expect(tree.map((n) => n.id)).toEqual([A, PAGE]);
      expect(tree[0]!.children.map((n) => n.id)).toEqual([B]);
      expect(tree[1]!.href).toBe('/about');
    });

    it('drops items whose CMS page is missing or unpublished', async () => {
      prisma.menuItem.findMany.mockResolvedValue([
        menuItem({
          linkType: 'page',
          path: null,
          pageId: PAGE,
          page: { slug: 'draft', isPublished: false }
        }),
        menuItem({
          id: B,
          linkType: 'page',
          path: null,
          pageId: C,
          page: null
        })
      ]);

      const tree = await service.getPublicTree();
      expect(tree).toEqual([]);
    });
  });

  describe('getAdminTree', () => {
    it('keeps hidden items and flags unpublished pages', async () => {
      prisma.menuItem.findMany.mockResolvedValue([
        menuItem({ isVisible: false }),
        menuItem({
          id: B,
          linkType: 'page',
          path: null,
          pageId: PAGE,
          page: { slug: 'draft', isPublished: false }
        })
      ]);

      const tree = await service.getAdminTree();
      expect(tree).toHaveLength(2);
      expect(tree[0]!.isVisible).toBe(false);
      expect(tree[1]!.pageUnpublished).toBe(true);
    });
  });

  describe('create', () => {
    it('creates a path item', async () => {
      const node = await service.create({ labelEn: 'Blog', path: '/blog' });
      expect(prisma.menuItem.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ path: '/blog', linkType: 'path', pageId: null })
        })
      );
      expect(node.href).toBe('/blog');
    });

    it('rejects paths that do not start with a slash', async () => {
      await expect(service.create({ labelEn: 'X', path: 'events' })).rejects.toBeInstanceOf(
        BadRequestException
      );
    });

    it('requires a pageId for page links and verifies the page exists', async () => {
      await expect(service.create({ labelEn: 'X', linkType: 'page' })).rejects.toBeInstanceOf(
        BadRequestException
      );
      await expect(
        service.create({ labelEn: 'X', linkType: 'page', pageId: GHOST })
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('accepts a page link when the page exists', async () => {
      prisma.sitePage.findUnique.mockResolvedValue({ id: PAGE, slug: 'about' });
      prisma.menuItem.create.mockResolvedValue(
        menuItem({
          linkType: 'page',
          path: null,
          pageId: PAGE,
          page: { slug: 'about', isPublished: true }
        })
      );
      const node = await service.create({ labelEn: 'About', linkType: 'page', pageId: PAGE });
      expect(node.href).toBe('/about');
    });

    it('rejects a submenu parent that is itself a child', async () => {
      prisma.menuItem.findUnique.mockResolvedValue(menuItem({ id: B, parentId: A }));
      await expect(
        service.create({ labelEn: 'Child', path: '/child', parentId: B })
      ).rejects.toBeInstanceOf(BadRequestException);
    });
  });

  describe('update', () => {
    it('throws when the item does not exist', async () => {
      await expect(service.update(GHOST, { labelEn: 'X' })).rejects.toBeInstanceOf(
        NotFoundException
      );
    });

    it('clears the path when switching a path item to a page link', async () => {
      prisma.menuItem.findUnique.mockResolvedValue(menuItem());
      prisma.sitePage.findUnique.mockResolvedValue({ id: PAGE, slug: 'about' });
      prisma.menuItem.update.mockResolvedValue(
        menuItem({
          linkType: 'page',
          path: null,
          pageId: PAGE,
          page: { slug: 'about', isPublished: true }
        })
      );
      await service.update(A, { linkType: 'page', pageId: PAGE });
      expect(prisma.menuItem.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ path: null, pageId: PAGE, linkType: 'page' })
        })
      );
    });

    it('rejects setting a child as parent of another child', async () => {
      prisma.menuItem.findUnique.mockResolvedValue(menuItem({ id: B, parentId: A }));
      await expect(service.update(A, { parentId: B })).rejects.toBeInstanceOf(
        BadRequestException
      );
    });
  });

  describe('reorder', () => {
    it('applies new order and parents in a transaction', async () => {
      prisma.menuItem.findMany
        .mockResolvedValueOnce([{ id: A }, { id: B }])
        .mockResolvedValueOnce([]);
      const result = await service.reorder([
        { id: B, parentId: null, sortOrder: 0 },
        { id: A, parentId: B, sortOrder: 0 }
      ]);
      expect(prisma.$transaction).toHaveBeenCalled();
      expect(result).toEqual([]);
    });

    it('rejects entries for unknown items', async () => {
      prisma.menuItem.findMany.mockResolvedValue([{ id: A }]);
      await expect(
        service.reorder([{ id: GHOST, parentId: null, sortOrder: 0 }])
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('rejects nesting a submenu deeper than one level', async () => {
      prisma.menuItem.findMany
        .mockResolvedValueOnce([{ id: A }, { id: B }, { id: C }])
        .mockResolvedValueOnce([]);
      await expect(
        service.reorder([
          { id: A, parentId: null, sortOrder: 0 },
          { id: B, parentId: A, sortOrder: 0 },
          { id: C, parentId: B, sortOrder: 0 }
        ])
      ).rejects.toBeInstanceOf(BadRequestException);
    });
  });

  describe('remove', () => {
    it('throws when the item does not exist', async () => {
      await expect(service.remove(GHOST)).rejects.toBeInstanceOf(NotFoundException);
    });

    it('deletes the item', async () => {
      prisma.menuItem.findUnique.mockResolvedValue(menuItem());
      await expect(service.remove(A)).resolves.toEqual({ success: true });
      expect(prisma.menuItem.delete).toHaveBeenCalled();
    });
  });
});
