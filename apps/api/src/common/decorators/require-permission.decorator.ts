import { SetMetadata } from '@nestjs/common';
import { Permission } from '@kentslsc/shared';

export const PERMISSIONS_KEY = 'permissions';

/**
 * Restrict a route or controller to users that hold one of the listed
 * back-office permissions. `ADMIN` always bypasses permission checks.
 */
export const RequirePermission = (...permissions: Permission[]) =>
  SetMetadata(PERMISSIONS_KEY, permissions);
