import { SetMetadata } from '@nestjs/common';

export const ALLOW_UNVERIFIED_KEY = 'allowUnverified';

/**
 * Marks a route as reachable by a signed-in user who has not yet confirmed
 * their email address. Reserved for the handful of things such a user must be
 * able to do: manage their own session, resend the verification email, and view
 * or edit their own profile. Everything else is gated by EmailVerifiedGuard.
 */
export const AllowUnverified = () => SetMetadata(ALLOW_UNVERIFIED_KEY, true);
