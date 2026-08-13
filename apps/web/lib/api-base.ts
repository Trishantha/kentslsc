// Absolute origin of the API, for server-side use only (server components,
// sitemap, and the rewrite proxy in next.config.js).
//
// Client code must NOT use this. The browser talks to the API through the
// relative `/api` path (see lib/api.ts), which next.config.js rewrites to this
// origin. Keeping browser requests same-origin is what makes the app work
// behind a proxied host such as a GitHub Codespace, where `localhost` in the
// browser refers to the user's own machine rather than the server.
import { headers } from 'next/headers';

function normalizeApiOrigin(value: string): string {
  return value
    .replace(/\/api\/?$/, '')
    .replace(/\/$/, '');
}

const rawApiUrl = process.env.API_PROXY_TARGET ?? process.env.NEXT_PUBLIC_API_URL;

export const serverApiUrl = normalizeApiOrigin(rawApiUrl ?? 'http://localhost:3001');

/**
 * Runtime URL for the current frontend request, so server components can call
 * the same `/api` proxy that the browser uses. This avoids depending on a
 * build-time env var being available at runtime (e.g. in a Hostinger deployment
 * where only NEXT_PUBLIC_* and the runtime env are injected).
 */
export async function getServerApiUrl(): Promise<string> {
  try {
    const h = await headers();
    const host = h.get('host') ?? 'localhost:3000';
    const forwardedProto = h.get('x-forwarded-proto');
    const proto = forwardedProto ?? (host.includes('localhost') ? 'http' : 'https');
    return `${proto}://${host}`;
  } catch {
    return serverApiUrl;
  }
}
