import { Injectable } from '@nestjs/common';
import { MembershipFeature } from '@kentslsc/shared';
import { MembershipStatus } from '@kentslsc/database';
import { PrismaService } from '../core/prisma/prisma.service.js';

@Injectable()
export class MembershipFeaturesService {
  private readonly cacheTtlMs = 60_000;
  private readonly featureCache = new Map<string, { features: MembershipFeature[]; expiresAt: number }>();

  constructor(private readonly prisma: PrismaService) {}

  async userActiveFeatures(userId: string): Promise<MembershipFeature[]> {
    const now = Date.now();
    const cached = this.featureCache.get(userId);
    if (cached && cached.expiresAt > now) {
      return cached.features;
    }

    const membership = await this.prisma.membership.findFirst({
      where: {
        userId,
        deletedAt: null,
        status: MembershipStatus.ACTIVE,
        endDate: { gt: new Date() }
      },
      orderBy: { createdAt: 'desc' },
      include: { membershipType: true }
    });

    if (!membership) {
      this.featureCache.set(userId, { features: [], expiresAt: now + this.cacheTtlMs });
      return [];
    }

    const features = (membership.membershipType.features as MembershipFeature[]) ?? [];
    this.featureCache.set(userId, { features, expiresAt: now + this.cacheTtlMs });
    return features;
  }

  async userHasFeature(userId: string, feature: MembershipFeature): Promise<boolean> {
    const features = await this.userActiveFeatures(userId);
    return features.includes(feature);
  }

  async userHasFeatures(userId: string, features: MembershipFeature[]): Promise<boolean> {
    const activeFeatures = await this.userActiveFeatures(userId);
    return features.every((feature) => activeFeatures.includes(feature));
  }

  async requireFeature(userId: string, feature: MembershipFeature): Promise<void> {
    const hasFeature = await this.userHasFeature(userId, feature);
    if (!hasFeature) {
      throw new Error(`Missing required feature: ${feature}`);
    }
  }
}
