import { headers } from 'next/headers';
import { fetchWithRetry } from './server-fetch';

function normalizeApiOrigin(value: string): string {
  return value
    .replace(/\/api\/?$/, '')
    .replace(/\/$/, '');
}

async function getRequestOrigin(): Promise<string> {
  const headersList = await headers();
  const host = headersList.get('host') || 'localhost:3000';
  const protocol = headersList.get('x-forwarded-proto') || 'https';
  return `${protocol}://${host}`;
}

function getConfiguredApiOrigin(): string | undefined {
  return (
    process.env.API_PROXY_TARGET ??
    process.env.NEXT_PUBLIC_API_URL ??
    undefined
  );
}

export async function fetchWithOriginFallback<T>(
  path: string,
  parser: (res: Response) => Promise<T> = (res) => res.json()
): Promise<T | null> {
  const configuredOrigin = getConfiguredApiOrigin();
  const origins = new Set<string>();

  if (configuredOrigin) {
    origins.add(normalizeApiOrigin(configuredOrigin));
  }

  const requestOrigin = normalizeApiOrigin(await getRequestOrigin());
  origins.add(requestOrigin);

  const attempts: { origin: string; error?: string }[] = [];

  for (const origin of origins) {
    try {
      const res = await fetchWithRetry(`${origin}${path}`, { next: { revalidate: 60 } });
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
