import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { PrismaService } from '../core/prisma/prisma.service.js';
import { SupabaseStorageService } from '../core/supabase/supabase.service.js';
import { Prisma } from '@kentslsc/database';
import type { CreateGalleryDto, UpdateGalleryDto } from './dto/index.js';

const PHOTO_INCLUDE = { orderBy: { sortOrder: 'asc' as const } };
const ADMIN_GALLERY_INCLUDE = { photos: PHOTO_INCLUDE };
const PUBLIC_GALLERY_INCLUDE = { photos: { orderBy: { sortOrder: 'asc' as const }, take: 1 } };

type AdminGalleryPayload = Prisma.EventGalleryGetPayload<{ include: typeof ADMIN_GALLERY_INCLUDE }>;
type PublicGalleryPayload = Prisma.EventGalleryGetPayload<{ include: typeof PUBLIC_GALLERY_INCLUDE }>;

@Injectable()
export class GalleryService {
  private readonly logger = new Logger(GalleryService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly supabase: SupabaseStorageService
  ) {}

  async listPublished() {
    const items = await this.prisma.eventGallery.findMany({
      where: { isPublished: true, deletedAt: null },
      orderBy: { eventDate: 'desc' },
      include: { photos: { orderBy: { sortOrder: 'asc' }, take: 1 } }
    });
    return items.map((item) => this.toPublicResponse(item as unknown as PublicGalleryPayload));
  }

  async findBySlug(slug: string) {
    const item = await this.prisma.eventGallery.findUnique({
      where: { slug, deletedAt: null },
      include: ADMIN_GALLERY_INCLUDE
    });
    if (!item || !item.isPublished) throw new NotFoundException('Gallery not found');
    return this.toPublicResponse(item);
  }

  async listAdmin() {
    const items = await this.prisma.eventGallery.findMany({
      where: { deletedAt: null },
      orderBy: { createdAt: 'desc' },
      include: PUBLIC_GALLERY_INCLUDE
    });
    return items.map((item) => this.toAdminResponse(item as unknown as AdminGalleryPayload));
  }

  async findAdminById(id: string) {
    const item = await this.prisma.eventGallery.findUnique({
      where: { id, deletedAt: null },
      include: ADMIN_GALLERY_INCLUDE
    });
    if (!item) throw new NotFoundException('Gallery not found');
    return this.toAdminResponse(item);
  }

  async create(data: CreateGalleryDto) {
    const item = await this.prisma.eventGallery.create({
      data: {
        id: randomUUID(),
        title: data.title,
        slug: data.slug,
        description: data.description || null,
        eventDate: data.eventDate || null,
        isPublished: data.isPublished ?? false,
        photos: {
          create: this.buildPhotoCreates(data.photos).map((p) => ({ id: randomUUID(), ...p }))
        }
      },
      include: ADMIN_GALLERY_INCLUDE
    });
    return this.toAdminResponse(item);
  }

  async update(id: string, data: UpdateGalleryDto) {
    const existing = await this.findAdminById(id);

    if (data.photos !== undefined) {
      const removedPaths = existing.photos
        .map((p) => p.path)
        .filter((p): p is string => Boolean(p));
      for (const path of removedPaths) {
        await this.supabase.delete(path).catch((e) =>
          this.logger.warn(`Failed to delete old gallery photo ${path}: ${String(e)}`)
        );
      }
    }

    const item = await this.prisma.eventGallery.update({
      where: { id },
      data: {
        ...(data.title !== undefined && { title: data.title }),
        ...(data.slug !== undefined && { slug: data.slug }),
        ...(data.description !== undefined && { description: data.description || null }),
        ...(data.eventDate !== undefined && { eventDate: data.eventDate || null }),
        ...(data.isPublished !== undefined && { isPublished: data.isPublished }),
        ...(data.photos !== undefined && {
          photos: {
            deleteMany: {},
            create: this.buildPhotoCreates(data.photos)
          }
        })
      },
      include: ADMIN_GALLERY_INCLUDE
    });
    return this.toAdminResponse(item);
  }

  async remove(id: string) {
    const item = await this.findAdminById(id);
    const photoPaths = item.photos
      .map((p) => p.path)
      .filter((p): p is string => Boolean(p));
    for (const path of photoPaths) {
      await this.supabase.delete(path).catch((e) =>
        this.logger.warn(`Failed to delete gallery photo on removal ${path}: ${String(e)}`)
      );
    }
    await this.prisma.eventGallery.update({ where: { id }, data: { deletedAt: new Date() } });
    return { id, deleted: true };
  }

  private buildPhotoCreates(photos: CreateGalleryDto['photos']) {
    return (photos ?? []).map((p, idx) => ({
      url: p.url,
      path: p.path || null,
      caption: p.caption || null,
      sortOrder: idx
    }));
  }

  private toPublicResponse(item: PublicGalleryPayload) {
    return {
      id: item.id,
      title: item.title,
      slug: item.slug,
      description: item.description,
      eventDate: item.eventDate,
      isPublished: item.isPublished,
      photos: item.photos.map((p) => ({
        id: p.id,
        url: p.url,
        caption: p.caption,
        sortOrder: p.sortOrder
      }))
    };
  }

  private toAdminResponse(item: AdminGalleryPayload) {
    return {
      id: item.id,
      title: item.title,
      slug: item.slug,
      description: item.description,
      eventDate: item.eventDate,
      isPublished: item.isPublished,
      createdAt: item.createdAt,
      updatedAt: item.updatedAt,
      photos: item.photos.map((p) => ({
        id: p.id,
        url: p.url,
        path: p.path,
        caption: p.caption,
        sortOrder: p.sortOrder
      }))
    };
  }
}
