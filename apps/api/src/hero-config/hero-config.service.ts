import { Injectable } from '@nestjs/common';
import { PrismaService } from '../core/prisma/prisma.service.js';

@Injectable()
export class HeroConfigService {
  constructor(private readonly prisma: PrismaService) {}

  async get() {
    const config = await this.prisma.heroConfig.findFirst();
    if (!config) {
      return this.prisma.heroConfig.create({
        data: {
          mediaType: 'video',
          videoUrl: '/videos/kslsc-hero.webm',
          overlayStyle: 'noise',
          overlayOpacity: 75,
          videoOverlayOpacity: 75,
          videoPlaybackRate: 1
        }
      });
    }
    return config;
  }

  async update(data: {
    mediaType?: string;
    imageUrl?: string;
    videoUrl?: string;
    overlayStyle?: string;
    overlayOpacity?: number;
    videoOverlayOpacity?: number;
    videoPlaybackRate?: number;
  }) {
    const existing = await this.get();
    return this.prisma.heroConfig.update({
      where: { id: existing.id },
      data: {
        ...(data.mediaType !== undefined && { mediaType: data.mediaType }),
        ...(data.imageUrl !== undefined && { imageUrl: data.imageUrl || null }),
        ...(data.videoUrl !== undefined && { videoUrl: data.videoUrl || null }),
        ...(data.overlayStyle !== undefined && { overlayStyle: data.overlayStyle }),
        ...(data.overlayOpacity !== undefined && { overlayOpacity: data.overlayOpacity }),
        ...(data.videoOverlayOpacity !== undefined && { videoOverlayOpacity: data.videoOverlayOpacity }),
        ...(data.videoPlaybackRate !== undefined && { videoPlaybackRate: data.videoPlaybackRate })
      }
    });
  }
}
