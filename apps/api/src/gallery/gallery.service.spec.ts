import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { GalleryService } from './gallery.service.js';
import { NotFoundException } from '@nestjs/common';

const mockDate = new Date('2024-01-15T12:00:00.000Z');

const createPhoto = (overrides: Partial<{ id: string; url: string; path: string; caption: string | null; sortOrder: number }> = {}) => ({
  id: `photo-${overrides.sortOrder ?? 0}`,
  url: 'https://cdn.example.com/gallery/photo.jpg',
  path: `gallery/photo-${overrides.sortOrder ?? 0}.jpg`,
  caption: null,
  sortOrder: overrides.sortOrder ?? 0,
  ...overrides
});

const createGalleryRecord = (overrides: Partial<any> = {}) => ({
  id: 'gallery-1',
  title: 'Test Gallery',
  slug: 'test-gallery',
  description: null,
  eventDate: null,
  isPublished: false,
  createdAt: mockDate,
  updatedAt: mockDate,
  deletedAt: null,
  photos: [createPhoto({ sortOrder: 0 }), createPhoto({ sortOrder: 1 }), createPhoto({ sortOrder: 2 })],
  ...overrides
});

describe('GalleryService', () => {
  let service: GalleryService;
  let mockPrisma: any;
  let mockSupabase: any;

  beforeEach(() => {
    mockPrisma = {
      eventGallery: {
        findUnique: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
        update: jest.fn()
      }
    };
    mockSupabase = {
      delete: jest.fn().mockImplementation(() => Promise.resolve())
    };

    service = new GalleryService(mockPrisma as any, mockSupabase as any);
  });

  describe('update', () => {
    it('does not delete storage files when only reordering or recaptioning photos', async () => {
      const existing = createGalleryRecord();
      mockPrisma.eventGallery.findUnique.mockResolvedValue(existing);
      mockPrisma.eventGallery.update.mockResolvedValue({
        ...existing,
        photos: [
          { ...existing.photos[1]!, caption: 'New caption', sortOrder: 0 },
          { ...existing.photos[0]!, sortOrder: 1 },
          existing.photos[2]!
        ]
      });

      await service.update(existing.id, {
        photos: [
          { url: existing.photos[1]!.url, path: existing.photos[1]!.path, caption: 'New caption' },
          { url: existing.photos[0]!.url, path: existing.photos[0]!.path },
          { url: existing.photos[2]!.url, path: existing.photos[2]!.path }
        ]
      });

      expect(mockSupabase.delete).not.toHaveBeenCalled();
    });

    it('deletes only the storage paths of removed photos', async () => {
      const existing = createGalleryRecord();
      mockPrisma.eventGallery.findUnique.mockResolvedValue(existing);
      mockPrisma.eventGallery.update.mockResolvedValue({
        ...existing,
        photos: [existing.photos[0], existing.photos[2]]
      });

      await service.update(existing.id, {
        photos: [
          { url: existing.photos[0]!.url, path: existing.photos[0]!.path },
          { url: existing.photos[2]!.url, path: existing.photos[2]!.path }
        ]
      });

      expect(mockSupabase.delete).toHaveBeenCalledTimes(1);
      expect(mockSupabase.delete).toHaveBeenCalledWith(existing.photos[1]!.path);
    });

    it('deletes storage files after the database update succeeds', async () => {
      const existing = createGalleryRecord();
      mockPrisma.eventGallery.findUnique.mockResolvedValue(existing);
      mockPrisma.eventGallery.update.mockResolvedValue({
        ...existing,
        photos: [existing.photos[0], existing.photos[2]]
      });

      await service.update(existing.id, {
        photos: [
          { url: existing.photos[0]!.url, path: existing.photos[0]!.path },
          { url: existing.photos[2]!.url, path: existing.photos[2]!.path }
        ]
      });

      const updateCallOrder = mockPrisma.eventGallery.update.mock.invocationCallOrder[0];
      const deleteCallOrder = mockSupabase.delete.mock.invocationCallOrder[0];
      expect(deleteCallOrder).toBeGreaterThan(updateCallOrder);
    });

    it('logs storage cleanup failures without throwing', async () => {
      const existing = createGalleryRecord();
      const loggerWarnSpy = jest.spyOn((service as any).logger, 'warn').mockImplementation(() => undefined);
      mockPrisma.eventGallery.findUnique.mockResolvedValue(existing);
      mockPrisma.eventGallery.update.mockResolvedValue({
        ...existing,
        photos: [existing.photos[0]]
      });
      mockSupabase.delete.mockRejectedValue(new Error('Storage unavailable'));

      await expect(
        service.update(existing.id, {
          photos: [{ url: existing.photos[0]!.url, path: existing.photos[0]!.path }]
        })
      ).resolves.toBeDefined();

      expect(mockSupabase.delete).toHaveBeenCalled();
      expect(loggerWarnSpy).toHaveBeenCalledWith(expect.stringContaining('Storage unavailable'));

      loggerWarnSpy.mockRestore();
    });

    it('throws NotFoundException when the gallery does not exist', async () => {
      mockPrisma.eventGallery.findUnique.mockResolvedValue(null);

      await expect(service.update('missing-id', { title: 'New title' })).rejects.toThrow(NotFoundException);
    });
  });
});
