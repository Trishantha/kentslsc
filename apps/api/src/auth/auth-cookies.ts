import type { CookieOptions } from 'express';
import {
  accessTokenCookieName as sharedAccessTokenCookieName,
  refreshTokenCookieName as sharedRefreshTokenCookieName
} from '@kentslsc/shared';

const isProduction = process.env.NODE_ENV === 'production';

/**
 * Shared attributes for the auth cookies.
 *
 * `sameSite: 'lax'` rather than 'strict': verification and password-reset links
 * are clicked from an email client, which is a cross-site top-level navigation.
 * Under 'strict' the browser sends no cookies on that first request, so the
 * landing page renders as logged-out for a user who is in fact signed in.
 * 'lax' still withholds cookies from cross-site POSTs, which is the CSRF case
 * that matters here.
 *
 * In production the names carry the `__Host-` prefix, which forces the browser
 * to reject any cookie that is not `Secure`, `Path=/`, and without a `Domain`
 * attribute. That prefix therefore also requires `secure: true` here.
 */
export function authCookieOptions(): CookieOptions {
  return {
    httpOnly: true,
    secure: isProduction,
    sameSite: 'lax',
    path: '/'
  };
}

export function accessTokenCookieName(): string {
  return sharedAccessTokenCookieName(isProduction);
}

export function refreshTokenCookieName(): string {
  return sharedRefreshTokenCookieName(isProduction);
}
