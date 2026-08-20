import axios from 'axios';
import { csrfTokenCookieName } from '@kentslsc/shared';
import { safeRedirect } from './safe-redirect';

/**
 * The browser must always talk to the API through the Next.js rewrite proxy
 * (`/api/*` -> API origin). A public absolute URL here would make the browser
 * send cross-origin requests, which breaks the httpOnly session cookies because
 * they are scoped to the frontend origin with SameSite=Lax. The proxy keeps
 * everything same-origin and works behind forwarded hosts such as Codespaces.
 */
export const baseURL = '/api';

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
  const match = document.cookie.match(
    new RegExp('(?:^|; )' + name.replace(/([.$?*|{}()[\]\\/+^])/g, '\\$1') + '=([^;]*)')
  );
  return match?.[1] ? decodeURIComponent(match[1]) : undefined;
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
// They should not trigger a forced redirect to the login page.
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
      window.location.href = '/verify-email';
      return Promise.reject(error);
    }

    if (error.response?.status === 401 && originalRequest && !originalRequest._retry) {
      const isOptionalAuth = optionalAuthEndpoints.some((url) =>
        originalRequest.url?.includes(url)
      );
      if (isOptionalAuth) {
        return Promise.reject(error);
      }

      originalRequest._retry = true;
      try {
        await axios.post(
          `${baseURL}/auth/refresh`,
          {},
          { withCredentials: true }
        );
        return api(originalRequest);
      } catch {
        // Preserve where the user was so they land back there after logging in,
        // rather than being dumped on the dashboard.
        const here = `${window.location.pathname}${window.location.search}`;
        const target = safeRedirect(here, '/dashboard');
        const localeMatch = window.location.pathname.match(/^\/(en|si|ta)(?:\/|$)/);
        const localePrefix = localeMatch ? `/${localeMatch[1]}` : '';
        window.location.href = `${localePrefix}/auth/login?redirect=${encodeURIComponent(target)}`;
      }
    }
    return Promise.reject(error);
  }
);
