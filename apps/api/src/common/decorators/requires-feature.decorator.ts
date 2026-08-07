import { SetMetadata } from '@nestjs/common';
import { MembershipFeature } from '@kentslsc/shared';

export const FEATURES_KEY = 'features';
export const RequiresFeature = (...features: MembershipFeature[]) => SetMetadata(FEATURES_KEY, features);
