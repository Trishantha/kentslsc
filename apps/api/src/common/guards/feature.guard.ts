import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { MembershipFeature, UserRole, type TokenPayload } from '@kentslsc/shared';
import { FEATURES_KEY } from '../decorators/requires-feature.decorator.js';
import { MembershipFeaturesService } from '../../memberships/membership-features.service.js';

@Injectable()
export class FeatureGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly featuresService: MembershipFeaturesService
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requiredFeatures = this.reflector.getAllAndOverride<MembershipFeature[]>(FEATURES_KEY, [
      context.getHandler(),
      context.getClass()
    ]);

    if (!requiredFeatures || requiredFeatures.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest<{ user: TokenPayload }>();
    const user = request.user;

    if (!user) {
      throw new ForbiddenException('Authentication required');
    }

    // Admins bypass feature checks
    if (user.role === UserRole.ADMIN) {
      return true;
    }

    const hasFeature = await this.featuresService.userHasFeatures(user.sub, requiredFeatures);
    if (!hasFeature) {
      throw new ForbiddenException('Your membership does not include this feature');
    }

    return true;
  }
}
