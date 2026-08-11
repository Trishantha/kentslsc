import axios from 'axios';
import { safeRedirect } from './safe-redirect';

const envUrl = process.env.NEXT_PUBLIC_API_URL;
export const baseURL = envUrl ? `${envUrl.replace(/\/$/, '')}/api` : '/api';

export const api = axios.create({
  baseURL,
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json'
  }
});

// These endpoints are allowed to return 401 for anonymous users on public pages.
// They should not trigger a forced redirect to the login page.
const optionalAuthEndpoints = ['/auth/me', '/auth/features'];

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
        window.location.href = `/auth/login?redirect=${encodeURIComponent(target)}`;
      }
    }
    return Promise.reject(error);
  }
);
