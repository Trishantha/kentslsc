import type { Permission, TokenPayload } from '@kentslsc/shared';

/**
 * What `@CurrentUser()` actually resolves to once JwtStrategy has validated the
 * request. A superset of TokenPayload, so existing handlers typed as
 * `TokenPayload` keep working.
 *
 * `emailVerified` deliberately lives here and NOT in the JWT: baking it into the
 * token would leave it stale for up to 15 minutes after the user verifies, so
 * they'd keep getting 403s on a page that just told them they were verified.
 * JwtStrategy already loads the user row on every request, so reading it there
 * costs nothing extra.
 *
 * `permissions` is also read from the database on every request so permission
 * changes take effect immediately without waiting for token expiry.
 */
export interface AuthenticatedUser extends TokenPayload {
  sid: string;
  emailVerified: boolean;
  permissions: Permission[];
}
