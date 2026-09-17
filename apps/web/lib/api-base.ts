// Absolute origin of the API, for server-side use only (server components,
// sitemap, and the rewrite proxy in next.config.js).
//
// Client code must NOT use this. The browser talks to the API through the
// relative `/api` path (see lib/api.ts), which next.config.js rewrites to this
// origin. Keeping browser requests same-origin is what makes the app work
// behind a proxied host such as a GitHub Codespace, where `localhost` in the
// browser refers to the user's own machine rather than the server.

import { headers } from 'next/headers';
import { readEnv } from './env';

function normalizeApiOrigin(value: string): string {
  return value
    .replace(/\/api\/?$/, '')
    .replace(/\/$/, '');
}

/**
 * Build an origin from the incoming request headers.
 *
 * This is used as a fallback when no environment variable points the frontend
 * server to a reachable API. In the unified server the API and web handler share
 * the same port, so a self-referential origin lets server-side fetches reach the
 * local proxy without relying on external DNS.
 */
async function getRequestOrigin(): Promise<string | undefined> {
  try {
    const requestHeaders = await headers();
    const host = requestHeaders.get('host') ?? requestHeaders.get('x-forwarded-host');
    if (!host) return undefined;

    // Trust x-forwarded-proto when present (common behind reverse proxies),
    // otherwise default to https on standard ports and http otherwise. The
    // request itself is reaching the frontend server, so the same transport is
    // valid for the local API proxy.
    let proto = requestHeaders.get('x-forwarded-proto');
    if (!proto) {
      proto = host.includes(':443') ? 'https' : 'http';
    }
    return normalizeApiOrigin(`${proto}://${host}`);
  } catch {
    // headers() throws outside a request context (e.g. during static generation
    // or middleware). Fall back to environment variables / loopback instead.
    return undefined;
  }
}

/**
 * All candidate origins that the frontend server might use to reach the API,
 * ordered from most explicit to least explicit.
 *
 * Callers that must reach the API (e.g. session checks) should try these in
 * order and use the first one that responds, rather than betting on a single
 * resolved origin. A configured public origin may be unreachable from inside the
 * container even when a self-referential or loopback origin works fine.
 */
export async function getApiOriginCandidates(): Promise<string[]> {
  const candidates = new Set<string>();

  const internal = readEnv('INTERNAL_API_URL');
  if (internal) candidates.add(normalizeApiOrigin(internal));

  const publicOrigin = readEnv('API_PROXY_TARGET') ?? readEnv('NEXT_PUBLIC_API_URL');
  if (publicOrigin) candidates.add(normalizeApiOrigin(publicOrigin));

  const requestOrigin = await getRequestOrigin();
  if (requestOrigin) candidates.add(requestOrigin);

  const port = readEnv('PORT') ?? readEnv('WEB_PORT') ?? '3000';
  candidates.add(`http://127.0.0.1:${port}`);

  return [...candidates];
}
