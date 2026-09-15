import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { refreshTokenCookieName } from '@kentslsc/shared';
import { safeRedirect } from './lib/safe-redirect';

const isProduction = process.env.NODE_ENV === 'production';

const maintenanceModeEnabled = process.env.MAINTENANCE_MODE === 'true';
const maintenancePath = '/maintenance';

// These live outside the [locale] segment and supply their own layouts.
const protectedPrefixes = ['/dashboard', '/forum', '/admin', '/verify-email'];

function isProtectedPath(pathname: string) {
  return protectedPrefixes.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)
  );
}

function isMaintenancePath(pathname: string) {
  return pathname === maintenancePath || pathname.startsWith(`${maintenancePath}/`);
}

// Locale prefixing is applied by the unified server (server.js) BEFORE the
// request reaches Next.js, and marked with the x-locale-routed header. We
// deliberately do NOT use next-intl's middleware rewrite here: Next 16
// resolves middleware rewrites whose origin matches the request inline,
// without entering Next's workStore context, and every dynamic page render
// then crashes with "Expected workStore to be initialized" (E1068,
// vercel/next.js#91844). Routing requests straight to the [locale] segment
// avoids the rewrite path entirely.

// Internal round-trips should no longer occur (nothing rewrites), but if one
// ever arrives, serve it directly rather than re-applying routing logic.
function isInternalRewriteRequest(request: NextRequest) {
  if (process.env.NODE_ENV !== 'production') {
    return false;
  }
  const host = request.headers.get('host') || '';
  return /^(localhost|127\.0\.0\.1|0\.0\.0\.0):\d+$/.test(host);
}

export function proxy(request: NextRequest) {
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

  if (request.headers.get('x-locale-routed') === '1') {
    // Presence of a refresh cookie is the signal that a session exists at all.
    // The access cookie lasts 15 minutes while the session lasts 7 days, so
    // keying on accessToken bounced still-valid sessions to login on every
    // hard navigation.
    const hasSession = Boolean(
      request.cookies.get(refreshTokenCookieName(isProduction))?.value
    );

    if (isProtectedPath(pathname) && !hasSession) {
      const loginUrl = new URL('/auth/login', redirectBase);
      loginUrl.searchParams.set('redirect', safeRedirect(`${pathname}${search}`));
      return NextResponse.redirect(loginUrl);
    }
    // NOTE: this is a cheap routing decision, not an authorisation check. The
    // cookie is not verified here, and the secret stays with the API (which
    // enforces auth on every request). Real enforcement is the server layouts
    // (which call GET /auth/session) plus the API guards.
    return NextResponse.next();
  }

  if (isInternalRewriteRequest(request)) {
    return NextResponse.next();
  }

  // Unmarked request (e.g. Next served directly without the unified server):
  // let it through unmodified rather than applying a locale rewrite.
  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!api|_next|uploads|.*\\.).*)']
};
