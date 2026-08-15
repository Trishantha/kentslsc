interface FetchWithRetryOptions extends RequestInit {
  retries?: number;
  retryDelayMs?: number;
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
 * Backward-compatible wrapper around fetchWithRetryResult().
 *
 * Returns the Response on success (including non-OK HTTP responses, which are
 * logged), or null on network/API failure. Callers that need to distinguish 404
 * from other errors should use fetchWithRetryResult() instead.
 */
export async function fetchWithRetry(
  url: string,
  options: FetchWithRetryOptions = {}
): Promise<Response | null> {
  const result = await fetchWithRetryResult(url, options);
  if (result.ok) return result.response;
  return null;
}
