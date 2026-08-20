'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { api } from '@/lib/api';
import { safeRedirect } from '@/lib/safe-redirect';

const PROTECTED_PATHS = ['/dashboard', '/forum', '/admin', '/verify-email'];
const POLL_INTERVAL_MS = 60_000;

function isProtectedPath(path: string): boolean {
  return PROTECTED_PATHS.some((prefix) => path === prefix || path.startsWith(`${prefix}/`));
}

function buildLoginRedirect(pathname: string, search: string): string {
  const target = safeRedirect(`${pathname}${search}`, '/dashboard');
  return `/auth/login?redirect=${encodeURIComponent(target)}`;
}

/**
 * Client-side session heartbeat for protected portal areas.
 *
 * Server layouts only validate the session on the initial render and on hard
 * navigations. Once a dashboard/admin page is mounted, a session can expire
 * (refresh token revoked, session deleted, cookie cleared) without the layout
 * re-running. This component polls the lightweight `/auth/session` probe and
 * sends the user to the login page as soon as the session is no longer live.
 */
export function SessionWatcher() {
  const pathname = usePathname();

  useEffect(() => {
    if (typeof document === 'undefined') return;
    if (!isProtectedPath(pathname)) return;

    let cancelled = false;

    const checkSession = async () => {
      try {
        // The cache-buster makes sure we never rely on a stale axios/HTTP cache.
        const { data } = await api.get<{ authenticated: boolean }>('/auth/session', {
          params: { _t: Date.now() }
        });

        if (cancelled) return;

        if (data.authenticated === false && isProtectedPath(window.location.pathname)) {
          window.location.href = buildLoginRedirect(
            window.location.pathname,
            window.location.search
          );
        }
      } catch {
        // If the API is unreachable, don't bounce the user; the next real
        // authenticated request will hit the axios 401 interceptor.
      }
    };

    checkSession();
    const intervalId = setInterval(checkSession, POLL_INTERVAL_MS);

    const handleVisibilityChange = () => {
      if (!document.hidden) {
        checkSession();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      cancelled = true;
      clearInterval(intervalId);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [pathname]);

  return null;
}
