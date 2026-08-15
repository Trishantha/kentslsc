import { getApiOriginCandidates } from './api-base';
import { fetchWithRetry, type FetchWithRetryOptions } from './server-fetch';

interface FetchWithOriginFallbackOptions<T> extends FetchWithRetryOptions {
  parser?: (res: Response) => Promise<T>;
}

/**
 * Fetch from the API using every known origin candidate until one responds.
 *
 * Uses the same candidate list as fetchApiWithOriginFallback() (INTERNAL_API_URL,
 * API_PROXY_TARGET, request origin, loopback) so server-side renders keep working
 * even when a configured public origin is unreachable from inside the frontend
 * container.
 */
export async function fetchWithOriginFallback<T>(
  path: string,
  options: FetchWithOriginFallbackOptions<T> = {}
): Promise<T | null> {
  const { parser = (res: Response) => res.json() as Promise<T>, ...fetchOptions } = options;
  const origins = await getApiOriginCandidates();
  const attempts: { origin: string; error?: string }[] = [];

  for (const origin of origins) {
    try {
      const res = await fetchWithRetry(`${origin}${path}`, fetchOptions);
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
