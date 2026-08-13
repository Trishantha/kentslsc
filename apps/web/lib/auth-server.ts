import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { getServerApiUrl } from './api-base';

export type SessionRole = 'ADMIN' | 'MEMBER' | 'BUSINESS_OWNER' | 'GUEST';

export type ServerSession =
  | { authenticated: false }
  | {
      authenticated: true;
      userId: string;
      role: SessionRole;
      emailVerified: boolean;
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
  if (!cookieHeader) return { authenticated: false };

  try {
    const apiUrl = await getServerApiUrl();
    const res = await fetch(`${apiUrl}/api/auth/session`, {
      headers: { cookie: cookieHeader },
      cache: 'no-store'
    });
    if (!res.ok) return { authenticated: false };
    return (await res.json()) as ServerSession;
  } catch {
    // API unreachable: treat as signed out rather than rendering a member area
    // we could not authorise.
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
