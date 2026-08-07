import { Module } from '@nestjs/common';
import { PrismaModule } from '../core/prisma/prisma.module.js';
import { MembershipFeaturesService } from '../memberships/membership-features.service.js';
import { FeatureGuard } from '../common/guards/feature.guard.js';

@Module({
  imports: [PrismaModule],
  providers: [MembershipFeaturesService, FeatureGuard],
  exports: [MembershipFeaturesService, FeatureGuard]
})
export class AuthorizationModule {}
