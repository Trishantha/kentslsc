import { Module } from '@nestjs/common';
import { MembershipFeaturesService } from '../memberships/membership-features.service.js';

/**
 * Membership feature entitlement lookup.
 *
 * This module is intentionally separate from MembershipsModule to break a
 * circular dependency: AuthorizationModule needs the feature service for the
 * global FeatureGuard, while MembershipsModule (and other feature modules) need
 * AuthorizationModule for the same guard. By placing the feature service in a
 * leaf module, both sides can import it without creating a cycle.
 */
@Module({
  providers: [MembershipFeaturesService],
  exports: [MembershipFeaturesService]
})
export class MembershipFeaturesModule {}
