import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { PrismaService } from '../core/prisma/prisma.service.js';

export interface SiteSettingsDto {
  email?: string;
  phone?: string;
  whatsapp?: string;
  address?: string;
  facebook?: string;
  instagram?: string;
  twitter?: string;
  youtube?: string;
  linkedin?: string;
  tiktok?: string;
  showPageLoader?: boolean;
}

const DEFAULT_SITE_SETTINGS = {
  email: 'info@kentslsc.org',
  phone: '+44 1234 567890',
  address: 'Kent Sri Lankan Social Club, Community Centre, Maidstone, Kent ME15 9JQ'
};

@Injectable()
export class SiteSettingsService {
  private readonly logger = new Logger(SiteSettingsService.name);

  constructor(private readonly prisma: PrismaService) {}

  async get() {
    try {
      const existing = await this.prisma.siteSettings.findFirst();
      if (existing) return existing;

      return await this.prisma.siteSettings.create({
        data: DEFAULT_SITE_SETTINGS
      });
    } catch (error) {
      this.logger.warn(
        `Unable to read site settings from the database; returning defaults. ${
          error instanceof Error ? error.message : String(error)
        }`
      );
      return DEFAULT_SITE_SETTINGS;
    }
  }

  async update(data: SiteSettingsDto) {
    const existing = await this.get();
    if (!('id' in existing)) {
      throw new ServiceUnavailableException(
        'Site settings cannot be updated while the database is unavailable.'
      );
    }
    return this.prisma.siteSettings.update({
      where: { id: existing.id },
      data: {
        ...(data.email !== undefined && { email: data.email || null }),
        ...(data.phone !== undefined && { phone: data.phone || null }),
        ...(data.whatsapp !== undefined && { whatsapp: data.whatsapp || null }),
        ...(data.address !== undefined && { address: data.address || null }),
        ...(data.facebook !== undefined && { facebook: data.facebook || null }),
        ...(data.instagram !== undefined && { instagram: data.instagram || null }),
        ...(data.twitter !== undefined && { twitter: data.twitter || null }),
        ...(data.youtube !== undefined && { youtube: data.youtube || null }),
        ...(data.linkedin !== undefined && { linkedin: data.linkedin || null }),
        ...(data.tiktok !== undefined && { tiktok: data.tiktok || null }),
        ...(data.showPageLoader !== undefined && { showPageLoader: data.showPageLoader })
      }
    });
  }

  async updateSeo(data: {
    metaTitle?: string;
    metaDescription?: string;
    metaKeywords?: string;
  }) {
    const existing = await this.get();
    if (!('id' in existing)) {
      throw new ServiceUnavailableException(
        'Site settings cannot be updated while the database is unavailable.'
      );
    }
    return this.prisma.siteSettings.update({
      where: { id: existing.id },
      data: {
        ...(data.metaTitle !== undefined && { metaTitle: data.metaTitle || null }),
        ...(data.metaDescription !== undefined && { metaDescription: data.metaDescription || null }),
        ...(data.metaKeywords !== undefined && { metaKeywords: data.metaKeywords || null })
      }
    });
  }
}
