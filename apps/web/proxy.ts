import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { DEFAULT_LOCALE, LOCALES, refreshTokenCookieName } from '@kentslsc/shared';
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

// In production, locale prefixing is applied by the unified server (server.js)
// BEFORE the request reaches Next.js, and marked with the x-locale-routed
// header. When Next is served directly (next dev without the unified server),
// no such header arrives, so we reproduce server.js's routing here with a
// REDIRECT. We deliberately never rewrite: Next 16 resolves middleware
// rewrites whose origin matches the request inline, without entering Next's
// workStore context, and every dynamic page render then crashes with
// "Expected workStore to be initialized" (E1068, vercel/next.js#91844).
// Without this, unprefixed client navigations (next-intl omits the locale
// prefix for the default locale) reach [locale] with an invalid locale and
// render the 404 page — including every /checkout payment flow.

// Mirrors server.js LOCALE_ROUTER_EXACT_PATHS / LOCALE_ROUTER_PREFIX_TREES.
// The proxy matcher already excludes api, _next, uploads and dotted paths.
const localeSegments = new Set<string>(LOCALES);
const nonLocalizedExactPaths = new Set(['/login', '/maintenance', '/verify-email']);
const nonLocalizedPrefixTrees = ['/admin', '/dashboard', '/forum'];

function detectRequestLocale(acceptLanguage: string | null) {
  if (acceptLanguage) {
    for (const entry of acceptLanguage.split(',')) {
      const base = (entry.split(';')[0] ?? '').trim().toLowerCase().split('-')[0];
      if (base && localeSegments.has(base)) {
        return base;
      }
    }
  }
  return DEFAULT_LOCALE;
}

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

  // Unmarked request (Next served directly, e.g. `next dev` without the
  // unified server): apply the same locale prefixing server.js performs in
  // production, so unprefixed navigations land on the [locale] route.
  if (request.method === 'GET') {
    const firstSegment = pathname.slice(1).split('/')[0] ?? '';
    const isNonLocalized =
      nonLocalizedExactPaths.has(pathname) ||
      nonLocalizedPrefixTrees.some((p) => pathname === p || pathname.startsWith(`${p}/`));
    if (firstSegment && !localeSegments.has(firstSegment) && !isNonLocalized) {
      const locale = detectRequestLocale(request.headers.get('accept-language'));
      const url = request.nextUrl.clone();
      url.pathname = `/${locale}${pathname === '/' ? '' : pathname}`;
      // Rewrite (not redirect): unprefixed client navigations send flight
      // (RSC) requests whose ?_rsc token Next strips before the proxy sees
      // it, so a redirect loses the token and the navigation dies. Rewrites
      // preserve the full request. This branch is dev-only in practice —
      // production requests arrive pre-marked (x-locale-routed) from
      // server.js, which prefixes them — so the Next 16 inline-rewrite
      // workStore crash (E1068) seen in production does not apply here.
      return NextResponse.rewrite(url);
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!api|_next|uploads|.*\\.).*)']
};
