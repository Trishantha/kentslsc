import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import createMiddleware from 'next-intl/middleware';
import { refreshTokenCookieName } from '@kentslsc/shared';
import { routing } from './i18n/routing';
import { safeRedirect } from './lib/safe-redirect';

const isProduction = process.env.NODE_ENV === 'production';

const intlMiddleware = createMiddleware(routing);
const maintenanceModeEnabled = process.env.MAINTENANCE_MODE === 'true';
const maintenancePath = '/maintenance';

// These live outside the [locale] segment and supply their own layouts.
const protectedPrefixes = ['/dashboard', '/forum', '/admin', '/verify-email'];

const localePattern = routing.locales.join('|');
// Matches /auth/login, /en/auth/register, etc.
const authPagePattern = new RegExp(`^(?:/(?:${localePattern}))?/auth/(?:login|register)/?$`);

function isProtectedPath(pathname: string) {
  return protectedPrefixes.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)
  );
}

function isMaintenancePath(pathname: string) {
  return pathname === maintenancePath || pathname.startsWith(`${maintenancePath}/`);
}

export function middleware(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const redirectBase =
    process.env.FRONTEND_URL ?? process.env.NEXT_PUBLIC_FRONTEND_URL ?? request.url;

  if (maintenanceModeEnabled && !isMaintenancePath(pathname)) {
    const url = request.nextUrl.clone();
    url.pathname = maintenancePath;
    url.search = '';
    return NextResponse.rewrite(url, { status: 503 });
  }

  if (isMaintenancePath(pathname)) {
    return NextResponse.next();
  }

  // Presence of a refresh cookie is the signal that a session exists at all.
  // The access cookie lasts 15 minutes while the session lasts 7 days, so keying
  // on accessToken bounced still-valid sessions to login on every hard navigation.
  const hasSession = Boolean(request.cookies.get(refreshTokenCookieName(isProduction))?.value);

  // A signed-in user has no business on the login or registration page. Blocking
  // it here is what stops an admin from walking into the registration wizard and
  // silently swapping their own session for a fresh GUEST account. The API
  // rejects POST /auth/register independently — this is the friendly half.
  if (authPagePattern.test(pathname)) {
    // Do not redirect authenticated users away from the login/register pages.
    // The middleware only knows that a refresh cookie exists, not whether it is
    // still valid. Redirecting based on cookie presence alone can trap users with
    // a stale/invalid cookie in a loop: login -> dashboard -> login. The API
    // already rejects POST /auth/register for authenticated users, and the
    // dashboard/server layouts perform the real session check.
    return intlMiddleware(request);
  }

  if (isProtectedPath(pathname)) {
    if (!hasSession) {
      const loginUrl = new URL('/auth/login', redirectBase);
      loginUrl.searchParams.set('redirect', safeRedirect(`${pathname}${search}`));
      return NextResponse.redirect(loginUrl);
    }
    // NOTE: this is a cheap routing decision, not an authorisation check. The
    // cookie is not verified here — middleware runs on the Edge runtime, and
    // pulling JWT_SECRET into the web bundle to verify it would couple the two
    // services' secrets. Real enforcement is the server layouts (which call
    // GET /auth/session) plus the API guards.
    return NextResponse.next();
  }

  // Everything else goes through next-intl for locale prefixing
  return intlMiddleware(request);
}

export const config = {
  matcher: ['/((?!api|_next|uploads|.*\\.).*)']
};
