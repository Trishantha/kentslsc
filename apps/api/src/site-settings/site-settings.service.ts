import { Injectable } from '@nestjs/common';
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

@Injectable()
export class SiteSettingsService {
  constructor(private readonly prisma: PrismaService) {}

  async get() {
    const existing = await this.prisma.siteSettings.findFirst();
    if (existing) return existing;

    return this.prisma.siteSettings.create({
      data: {
        email: 'info@kentslsc.org',
        phone: '+44 1234 567890',
        address: 'Kent Sri Lankan Social Club, Community Centre, Maidstone, Kent ME15 9JQ'
      }
    });
  }

  async update(data: SiteSettingsDto) {
    const existing = await this.get();
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
}
