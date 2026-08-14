import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { PrismaService } from '../core/prisma/prisma.service.js';
import type { UpdateGdprSettingsDto } from './dto/update-gdpr-settings.dto.js';

@Injectable()
export class GdprSettingsService {
  private readonly logger = new Logger(GdprSettingsService.name);

  constructor(private readonly prisma: PrismaService) {}

  async get() {
    try {
      const existing = await this.prisma.gdprSettings.findFirst();
      if (existing) return existing;
      return await this.prisma.gdprSettings.create({ data: {} });
    } catch (error) {
      this.logger.warn(
        `Unable to read GDPR settings from the database; returning defaults. ${
          error instanceof Error ? error.message : String(error)
        }`
      );
      return {
        cookieConsentEnabled: true,
        cookieConsentMessage:
          'We use cookies to improve your experience on our website. By continuing to browse, you agree to our use of cookies.',
        analyticsEnabled: false,
        marketingCookiesEnabled: false,
        dataRetentionDays: 365
      };
    }
  }

  async update(data: UpdateGdprSettingsDto) {
    const existing = await this.get();
    if (!('id' in existing)) {
      throw new ServiceUnavailableException(
        'GDPR settings cannot be updated while the database is unavailable.'
      );
    }
    return this.prisma.gdprSettings.update({
      where: { id: existing.id },
      data: {
        ...(data.cookieConsentEnabled !== undefined && { cookieConsentEnabled: data.cookieConsentEnabled }),
        ...(data.cookieConsentMessage !== undefined && { cookieConsentMessage: data.cookieConsentMessage || undefined }),
        ...(data.cookiePolicyUrl !== undefined && { cookiePolicyUrl: data.cookiePolicyUrl || null }),
        ...(data.privacyPolicyUrl !== undefined && { privacyPolicyUrl: data.privacyPolicyUrl || null }),
        ...(data.analyticsEnabled !== undefined && { analyticsEnabled: data.analyticsEnabled }),
        ...(data.marketingCookiesEnabled !== undefined && { marketingCookiesEnabled: data.marketingCookiesEnabled }),
        ...(data.dataRetentionDays !== undefined && { dataRetentionDays: data.dataRetentionDays }),
        ...(data.dpoName !== undefined && { dpoName: data.dpoName || null }),
        ...(data.dpoEmail !== undefined && { dpoEmail: data.dpoEmail || null }),
        ...(data.dpoPhone !== undefined && { dpoPhone: data.dpoPhone || null }),
        ...(data.gdprNotes !== undefined && { gdprNotes: data.gdprNotes || null })
      }
    });
  }
}
