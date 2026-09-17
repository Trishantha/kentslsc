import axios from 'axios';
import { csrfTokenCookieName, LOCALES } from '@kentslsc/shared';
import { safeRedirect } from './safe-redirect';
import { getCookieValue as readCookieValue } from './cookie-value';

/** Matches an optional locale path prefix, e.g. `/si/...`. */
const localePathRegex = new RegExp(`^/(${LOCALES.join('|')})(?:/|$)`);

/**
 * The browser must always talk to the API through the Next.js rewrite proxy
 * (`/api/*` -> API origin). A public absolute URL here would make the browser
 * send cross-origin requests, which breaks the httpOnly session cookies because
 * they are scoped to the frontend origin with SameSite=Lax. The proxy keeps
 * everything same-origin and works behind forwarded hosts such as Codespaces.
 */
const baseURL = '/api';

/**
 * Browser-side API client. Do not set a default Content-Type: axios
 * automatically sends `application/json` for plain objects and
 * `multipart/form-data` (with a boundary) for FormData uploads. A hard-coded
 * JSON header breaks file uploads because the server then receives the file
 * body as raw JSON and the `@UploadedFile()` decorator sees no file.
 */
export const api = axios.create({
  baseURL,
  withCredentials: true
});

function getCookieValue(name: string): string | undefined {
  if (typeof document === 'undefined') return undefined;
  return readCookieValue(document.cookie, name);
}

api.interceptors.request.use((config) => {
  const method = config.method?.toLowerCase();
  if (method && !['get', 'head', 'options'].includes(method)) {
    const csrfToken = getCookieValue(csrfTokenCookieName(process.env.NODE_ENV === 'production'));
    if (csrfToken) {
      config.headers.set('X-CSRF-Token', csrfToken);
    }
  }
  return config;
});

// These endpoints are allowed to return 401 for anonymous users on public pages.
// They should not trigger a forced redirect to the login page. `/auth/me` is
// special-cased below: its 401 usually means the short-lived access token
// expired while the session is still alive, so it gets a silent refresh-retry.
const optionalAuthEndpoints = [
  '/auth/me',
  '/auth/features',
  '/auth/login',
  '/auth/register',
  '/auth/forgot-password',
  '/auth/reset-password',
  '/auth/verify-email',
  '/auth/logout',
  '/auth/refresh',
  '/payments/public-settings',
  '/payments/stripe-config'
];

export function getApiErrorMessage(error: unknown): string {
  if (axios.isAxiosError(error)) {
    const data = error.response?.data;
    if (data) {
      if (typeof data.message === 'string') return data.message;
      if (Array.isArray(data.message)) return data.message.join(', ');
      if (typeof data.error === 'string') return data.error;
    }
    return error.message;
  }
  if (error instanceof Error) return error.message;
  return 'An unexpected error occurred.';
}

// Single in-flight refresh shared by all callers: the refresh token rotates on
// every use, so concurrent 401 retries must not each fire their own refresh —
// a replayed (already-rotated) token is treated as theft and kills the session.
let refreshSessionPromise: Promise<unknown> | null = null;

function refreshSession(): Promise<unknown> {
  if (!refreshSessionPromise) {
    refreshSessionPromise = axios
      .post(`${baseURL}/auth/refresh`, {}, { withCredentials: true })
      .finally(() => {
        refreshSessionPromise = null;
      });
  }
  return refreshSessionPromise;
}

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
    // The API gates the portal behind email confirmation. Send the user to the
    // screen that can actually resolve it rather than showing a bare 403.
    if (
      error.response?.status === 403 &&
      error.response.data?.code === 'EMAIL_NOT_VERIFIED' &&
      typeof window !== 'undefined' &&
      !window.location.pathname.startsWith('/verify-email')
    ) {
      window.location.replace('/verify-email');
      return Promise.reject(error);
    }

    if (error.response?.status === 401 && originalRequest && !originalRequest._retry) {
      const isOptionalAuth = optionalAuthEndpoints.some((url) =>
        originalRequest.url?.includes(url)
      );
      // Only `/auth/me` may absorb a 401 into a refresh-retry; the other
      // optional endpoints use 401 as a normal application outcome (e.g. a
      // failed login POST), which must be passed straight through.
      if (isOptionalAuth && !originalRequest.url?.includes('/auth/me')) {
        return Promise.reject(error);
      }

      originalRequest._retry = true;
      try {
        await refreshSession();
        return api(originalRequest);
      } catch {
        if (isOptionalAuth) {
          // The session itself is dead, but these endpoints also serve public
          // pages, so don't force a redirect from here; the SessionWatcher
          // probe handles bouncing and cache cleanup.
          return Promise.reject(error);
        }
        // Preserve where the user was so they land back there after logging in,
        // rather than being dumped on the dashboard.
        const here = `${window.location.pathname}${window.location.search}`;
        const target = safeRedirect(here, '/dashboard');
        const localeMatch = window.location.pathname.match(localePathRegex);
        const localePrefix = localeMatch ? `/${localeMatch[1]}` : '';
        window.location.replace(`${localePrefix}/auth/login?redirect=${encodeURIComponent(target)}`);
      }
    }
    return Promise.reject(error);
  }
);
