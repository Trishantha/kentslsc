import type { CookieOptions } from 'express';

/**
 * Shared attributes for the auth cookies.
 *
 * `sameSite: 'lax'` rather than 'strict': verification and password-reset links
 * are clicked from an email client, which is a cross-site top-level navigation.
 * Under 'strict' the browser sends no cookies on that first request, so the
 * landing page renders as logged-out for a user who is in fact signed in.
 * 'lax' still withholds cookies from cross-site POSTs, which is the CSRF case
 * that matters here.
 */
export function authCookieOptions(): CookieOptions {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/'
  };
}
