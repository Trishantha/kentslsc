import { Module } from '@nestjs/common';
import { PrismaModule } from '../core/prisma/prisma.module.js';
import { MembershipFeaturesModule } from '../membership-features/membership-features.module.js';
import { FeatureGuard } from '../common/guards/feature.guard.js';

@Module({
  imports: [PrismaModule, MembershipFeaturesModule],
  providers: [FeatureGuard],
  exports: [MembershipFeaturesModule, FeatureGuard]
})
export class AuthorizationModule {}
