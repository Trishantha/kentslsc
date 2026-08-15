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

/**
 * Resolve the public API origin at call time rather than module-load time.
 *
 * In unified/shared-hosting deployments the environment files are loaded after
 * the build, so baking the value in at import time captures the wrong default
 * (e.g. http://localhost:3001). Evaluating it lazily lets server.js-injected
 * variables like API_PROXY_TARGET take effect at runtime.
 */
function readEnv(key: string): string | undefined {
  // Use dynamic property access so the bundler cannot hoist the lookup to
  // module-evaluation time and capture a stale value.
  return process.env[key];
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
 * Resolve an API origin that the frontend server can actually reach.
 *
 * Resolution order:
 *   1. INTERNAL_API_URL (explicit internal origin)
 *   2. API_PROXY_TARGET / NEXT_PUBLIC_API_URL (configured public origin)
 *   3. The current request's own origin (for unified/same-container setups)
 *   4. http://127.0.0.1:<PORT|WEB_PORT|3000> (unified server loopback fallback)
 */
async function resolveApiOrigin(): Promise<string> {
  const internal = readEnv('INTERNAL_API_URL');
  if (internal) return normalizeApiOrigin(internal);

  const publicOrigin = readEnv('API_PROXY_TARGET') ?? readEnv('NEXT_PUBLIC_API_URL');
  if (publicOrigin) return normalizeApiOrigin(publicOrigin);

  const requestOrigin = await getRequestOrigin();
  if (requestOrigin) return requestOrigin;

  const port = readEnv('PORT') ?? readEnv('WEB_PORT') ?? '3000';
  return `http://127.0.0.1:${port}`;
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

/**
 * Public API origin.
 *
 * Used for server-side content fetches (pages, sitemap, fundraisers, etc.).
 * In shared-hosting/unified deployments this resolves to the same robust set of
 * fallbacks as getInternalApiUrl(), so server-side renders do not fail just
 * because the public domain is unreachable from inside the container.
 */
export async function getServerApiUrl(): Promise<string> {
  return resolveApiOrigin();
}

/**
 * Internal API origin for server-side calls.
 *
 * Some hosts (e.g. shared-hosting containers) can proxy browser requests to a
 * public API domain but cannot reach that same public origin from inside the
 * container. Set INTERNAL_API_URL to an origin the frontend container can
 * reach directly (e.g. an internal service URL or http://127.0.0.1:3000 when
 * the API runs in-process).
 */
export async function getInternalApiUrl(): Promise<string> {
  return resolveApiOrigin();
}
