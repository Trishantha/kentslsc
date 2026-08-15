import { getApiOriginCandidates } from './api-base';

export interface FetchWithRetryOptions extends RequestInit {
  retries?: number;
  retryDelayMs?: number;
  /** Next.js fetch cache options (used by server components). */
  next?: { revalidate?: number | false; tags?: string[] };
}

export type FetchResult =
  | { ok: true; response: Response }
  | { ok: false; status: number | null; error?: unknown };

/**
 * Fetch wrapper for Next.js server components.
 *
 * Retries transient network errors (e.g. the API is restarting during dev)
 * but does NOT retry HTTP error responses such as 404 or 500.
 *
 * Returns a tagged result so callers can distinguish "API unreachable" from a
 * genuine 404. For the simpler "response or null" behaviour, use fetchWithRetry().
 */
export async function fetchWithRetryResult(
  url: string,
  options: FetchWithRetryOptions = {}
): Promise<FetchResult> {
  const { retries = 3, retryDelayMs = 500, ...fetchOptions } = options;

  let lastError: unknown;

  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const response = await fetch(url, fetchOptions);
      if (!response.ok) {
        // Surface API-side failures in server logs instead of letting callers
        // silently treat 500s as "not found" or empty data.
        let body = '';
        try {
          body = (await response.clone().text()).slice(0, 500);
        } catch {
          // ignore
        }
        console.error(
          `Server fetch received HTTP ${response.status} from ${url}. Body: ${body || '(empty)'}`
        );
      }
      return { ok: true, response };
    } catch (error) {
      lastError = error;
      const isNetworkError =
        error instanceof TypeError ||
        (error instanceof Error &&
          /fetch|network|ECONNREFUSED|ENOTFOUND|ETIMEDOUT/i.test(error.message));

      if (!isNetworkError || attempt === retries) {
        break;
      }

      console.warn(
        `Server fetch attempt ${attempt}/${retries} failed for ${url}: ${(error as Error).message}. Retrying in ${retryDelayMs}ms...`
      );
      await new Promise((resolve) => setTimeout(resolve, retryDelayMs));
    }
  }

  console.error(`Server fetch failed after ${retries} attempts for ${url}`, lastError);
  return { ok: false, status: null, error: lastError };
}

/**
 * Try to reach the API through every known origin candidate.
 *
 * This is the resilient choice for server-side fetches where the configured
 * public API origin may not be reachable from inside the frontend container.
 * It tries INTERNAL_API_URL, API_PROXY_TARGET, the request's own origin and
 * local loopback, returning the first one that produces any response. Callers
 * still receive a tagged result so they can distinguish 404 from API errors.
 */
export async function fetchApiWithOriginFallback(
  path: string,
  options: FetchWithRetryOptions = {}
): Promise<FetchResult> {
  const origins = await getApiOriginCandidates();
  const attempts: { origin: string; error: string }[] = [];
  let lastStatus: number | null = null;

  for (const origin of origins) {
    const url = `${origin}${path}`;
    const result = await fetchWithRetryResult(url, options);

    // Treat non-2xx responses (and unexpected HTML, e.g. hitting the frontend
    // itself) as a failed attempt so we try the next origin candidate. This is
    // especially important on hosts where the public API domain is unreachable
    // from inside the container and we need to fall back to INTERNAL_API_URL or
    // the local loopback.
    const contentType = result.ok ? result.response.headers.get('content-type') ?? '' : '';
    const isJson = contentType.includes('application/json');
    if (result.ok && result.response.ok && isJson) {
      return result;
    }

    if (result.ok) {
      lastStatus = result.response.status;
    }

    attempts.push({
      origin,
      error: result.ok
        ? `HTTP ${result.response.status} (${isJson ? 'json' : contentType || 'unknown content-type'})`
        : String(result.error ?? 'no response')
    });
  }

  console.error(
    `Server fetch failed for ${path}. Tried origins: ${attempts
      .map((a) => `${a.origin} (${a.error})`)
      .join(', ')}`
  );
  return {
    ok: false,
    status: lastStatus,
    error: new Error(`All API origins failed for ${path}`)
  };
}

/**
 * Backward-compatible wrapper around fetchWithRetryResult().
 *
 * Returns the Response on success (including non-OK HTTP responses, which are
 * logged), or null on network/API failure. Callers that need to distinguish 404
 * from other errors should use fetchWithRetryResult() or
 * fetchApiWithOriginFallback() instead.
 */
export async function fetchWithRetry(
  url: string,
  options: FetchWithRetryOptions = {}
): Promise<Response | null> {
  const result = await fetchWithRetryResult(url, options);
  if (result.ok) return result.response;
  return null;
}


