import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { getInternalApiUrl } from './api-base';
import type { Permission } from '@kentslsc/shared';

export type SessionRole = 'ADMIN' | 'MEMBER' | 'BUSINESS_OWNER' | 'GUEST';

export type ServerSession =
  | { authenticated: false }
  | {
      authenticated: true;
      userId: string;
      role: SessionRole;
      emailVerified: boolean;
      permissions: Permission[];
    };

/**
 * Server-side session check.
 *
 * This is the real gate for the portal areas. The middleware only inspects
 * whether a cookie is present — it runs on the Edge runtime and deliberately
 * does no crypto, so it cannot tell a real token from a forged one. Everything
 * that actually depends on identity or role is decided here.
 *
 * Hits GET /auth/session, which accepts either the access or the refresh
 * cookie. That matters: a Next server component cannot call cookies().set(),
 * so it cannot perform a token refresh. If this relied on the 15-minute access
 * token alone, every user would be bounced to the login page a quarter of an
 * hour into a 7-day session.
 */
export async function getServerSession(): Promise<ServerSession> {
  const cookieHeader = cookies().toString();
  const hasAuthCookie =
    cookieHeader.includes('accessToken=') || cookieHeader.includes('refreshToken=');
  if (!cookieHeader) return { authenticated: false };

  try {
    const apiUrl = await getInternalApiUrl();
    const res = await fetch(`${apiUrl}/api/auth/session`, {
      headers: { cookie: cookieHeader },
      cache: 'no-store'
    });
    if (!res.ok) {
      // Log the failure so operators can distinguish a stale token (401), an
      // unverified account (403), or an API-side error (500) from a simple
      // "not signed in" case. Do not leak this to the browser.
      let body = '(empty)';
      try {
        body = await res.text();
      } catch {
        // ignore
      }
      console.error(
        `[auth-server] Session check returned HTTP ${res.status} from ${apiUrl}/api/auth/session. ` +
          `Has auth cookie: ${hasAuthCookie}. Body: ${body.slice(0, 500)}`
      );
      return { authenticated: false };
    }
    return (await res.json()) as ServerSession;
  } catch (error) {
    // API unreachable: treat as signed out rather than rendering a member area
    // we could not authorise. Log the resolved URL so container-to-container
    // reachability issues are diagnosable.
    const attemptedUrl = await getInternalApiUrl().catch(() => 'unknown');
    console.error(
      `[auth-server] Session check failed (API: ${attemptedUrl}, hasAuthCookie: ${hasAuthCookie}):`,
      error
    );
    return { authenticated: false };
  }
}

/** Require a signed-in, email-verified user. Redirects otherwise. */
export async function requireSession(options: { verified?: boolean } = {}) {
  const { verified = true } = options;
  const session = await getServerSession();

  if (!session.authenticated) {
    redirect('/auth/login');
  }
  if (verified && !session.emailVerified) {
    redirect('/verify-email');
  }

  return session;
}

/** Require a specific role. Non-admins are sent to their own dashboard, not the login page. */
export async function requireRole(role: SessionRole) {
  const session = await requireSession();
  if (session.role !== role) {
    redirect('/dashboard');
  }
  return session;
}

/** True when the session belongs to an admin or holds at least one of the given permissions. */
export function hasPermission(
  session: ServerSession,
  ...permissions: Permission[]
): session is Extract<ServerSession, { authenticated: true }> {
  if (!session.authenticated) return false;
  if (session.role === 'ADMIN') return true;
  const userPermissions = new Set(session.permissions ?? []);
  return permissions.some((p) => userPermissions.has(p));
}

/**
 * Gate the admin area: allow admins and any user with back-office permissions.
 */
export async function requireAdminOrBackOfficePermission() {
  const session = await requireSession();
  const userPermissions = new Set(session.permissions ?? []);
  const hasBackOfficePermission =
    session.role === 'ADMIN' || userPermissions.size > 0;
  if (!hasBackOfficePermission) {
    redirect('/dashboard');
  }
  return session;
}

/**
 * Require a specific back-office permission. Admins always pass.
 */
export async function requirePermission(...permissions: Permission[]) {
  const session = await requireSession();
  if (!hasPermission(session, ...permissions)) {
    redirect('/dashboard');
  }
  return session;
}
