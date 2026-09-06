'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { safeRedirect } from '@/lib/safe-redirect';
import { useAuth } from '@/hooks/useAuth';

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
 * Client-side session heartbeat.
 *
 * Server layouts only validate the session on the initial render and on hard
 * navigations, and the navbar's auth state comes from a cached react-query
 * result. A session can therefore expire without any visible change: the
 * dashboard link stays on the menu (rendered from the stale cache) and the
 * user only discovers it after clicking through to a protected page. Poll the
 * lightweight `/auth/session` probe whenever the user appears signed in — or
 * is inside a protected area — and send them to the login page as soon as the
 * session is no longer live.
 */
export function SessionWatcher() {
  const pathname = usePathname();
  const { user } = useAuth();
  const queryClient = useQueryClient();

  useEffect(() => {
    if (typeof document === 'undefined') return;
    if (!isProtectedPath(pathname) && user === null) return;

    let cancelled = false;

    const checkSession = async () => {
      try {
        // The cache-buster makes sure we never rely on a stale axios/HTTP cache.
        const { data } = await api.get<{ authenticated: boolean }>('/auth/session', {
          params: { _t: Date.now() }
        });

        if (cancelled) return;

        if (data.authenticated === false) {
          // Drop the stale cached identity so menus stop rendering
          // dashboard/profile entries for a dead session.
          queryClient.removeQueries({ queryKey: ['auth', 'me'] });

          // Only force a redirect from protected areas. On public pages the
          // stale cache is already cleared above; bouncing an anonymous
          // browser to the login screen mid-browse just strands readers.
          if (isProtectedPath(window.location.pathname)) {
            window.location.href = buildLoginRedirect(
              window.location.pathname,
              window.location.search
            );
          }
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
  }, [pathname, user, queryClient]);

  return null;
}
