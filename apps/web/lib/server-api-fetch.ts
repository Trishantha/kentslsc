import { cookies } from 'next/headers';
import { csrfTokenCookieName } from '@kentslsc/shared';
import { getApiOriginCandidates } from './api-base';
import { fetchWithRetry, type FetchWithRetryOptions } from './server-fetch';

interface FetchWithOriginFallbackOptions<T> extends FetchWithRetryOptions {
  parser?: (res: Response) => Promise<T>;
}

/**
 * Best-effort read of the incoming request cookies so server-side API calls can
 * forward the user's session. This is required for authenticated admin routes;
 * it is harmless for public routes. If cookies() is unavailable (e.g. outside a
 * request context) the fetch simply proceeds without them.
 */
async function getIncomingCookieHeader(): Promise<string | undefined> {
  try {
    return (await cookies()).toString();
  } catch {
    return undefined;
  }
}

function getCsrfToken(cookieHeader: string): string | undefined {
  const cookieName = csrfTokenCookieName(process.env.NODE_ENV === 'production');
  const match = cookieHeader.match(new RegExp('(?:^|;\\s*)' + cookieName + '=([^;]*)'));
  return match?.[1] ? decodeURIComponent(match[1]) : undefined;
}

function mergeCookieHeader(options: RequestInit, cookieHeader: string): RequestInit {
  const headers = new Headers(options.headers);
  if (!headers.has('cookie')) {
    headers.set('cookie', cookieHeader);
  }
  // Forward the CSRF double-submit token for any server-side state-changing call.
  const method = (options.method ?? 'GET').toUpperCase();
  if (!['GET', 'HEAD', 'OPTIONS'].includes(method) && !headers.has('x-csrf-token')) {
    const csrfToken = getCsrfToken(cookieHeader);
    if (csrfToken) {
      headers.set('x-csrf-token', csrfToken);
    }
  }
  return { ...options, headers };
}

/**
 * Fetch from the API using every known origin candidate until one responds.
 *
 * Uses the same candidate list as fetchApiWithOriginFallback() (INTERNAL_API_URL,
 * API_PROXY_TARGET, request origin, loopback) so server-side renders keep working
 * even when a configured public origin is unreachable from inside the frontend
 * container.
 *
 * Forwards the incoming request cookies so authenticated routes (e.g. admin detail
 * pages) work correctly during server-side rendering.
 */
export async function fetchWithOriginFallback<T>(
  path: string,
  options: FetchWithOriginFallbackOptions<T> = {}
): Promise<T | null> {
  const { parser = (res: Response) => res.json() as Promise<T>, ...fetchOptions } = options;
  const cookieHeader = await getIncomingCookieHeader();
  const fetchOptionsWithCookies = cookieHeader
    ? mergeCookieHeader(fetchOptions, cookieHeader)
    : fetchOptions;

  const origins = await getApiOriginCandidates();
  const attempts: { origin: string; error?: string }[] = [];

  for (const origin of origins) {
    try {
      const res = await fetchWithRetry(`${origin}${path}`, fetchOptionsWithCookies);
      if (res && res.ok) {
        return await parser(res);
      }
      attempts.push({ origin, error: res ? `HTTP ${res.status}` : 'no response' });
    } catch (error) {
      attempts.push({ origin, error: (error as Error).message });
    }
  }

  console.error(
    `Server fetch failed for ${path}. Tried origins:`,
    attempts.map((a) => `${a.origin} (${a.error})`).join(', ')
  );
  return null;
}
