import { SetMetadata } from '@nestjs/common';

/**
 * Marks a public route as optionally authenticated.
 *
 * The global JwtAuthGuard will skip authentication entirely for public routes
 * unless they carry this decorator. When optional auth is requested, the guard
 * still validates any credentials the client provides, but it allows anonymous
 * requests through if no credential is present. This prevents public routes from
 * silently swallowing malformed or expired tokens.
 */
export const IS_OPTIONAL_AUTH_KEY = 'isOptionalAuth';
export const OptionalAuthRoute = () => SetMetadata(IS_OPTIONAL_AUTH_KEY, true);
