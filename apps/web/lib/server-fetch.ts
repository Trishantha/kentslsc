interface FetchWithRetryOptions extends RequestInit {
  retries?: number;
  retryDelayMs?: number;
}

/**
 * Fetch wrapper for Next.js server components.
 *
 * Retries transient network errors (e.g. the API is restarting during dev)
 * but does NOT retry HTTP error responses such as 404 or 500.
 */
export async function fetchWithRetry(
  url: string,
  options: FetchWithRetryOptions = {}
): Promise<Response | null> {
  const { retries = 3, retryDelayMs = 500, ...fetchOptions } = options;

  let lastError: unknown;

  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const response = await fetch(url, fetchOptions);
      return response;
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
  return null;
}
