// Absolute origin of the API, for server-side use only (server components,
// sitemap, and the rewrite proxy in next.config.js).
//
// Client code must NOT use this. The browser talks to the API through the
// relative `/api` path (see lib/api.ts), which next.config.js rewrites to this
// origin. Keeping browser requests same-origin is what makes the app work
// behind a proxied host such as a GitHub Codespace, where `localhost` in the
// browser refers to the user's own machine rather than the server.
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

export async function getServerApiUrl(): Promise<string> {
  const raw = readEnv('API_PROXY_TARGET') ?? readEnv('NEXT_PUBLIC_API_URL');
  return normalizeApiOrigin(raw ?? 'http://localhost:3001');
}

/**
 * Internal API origin for server-side calls.
 *
 * Some hosts (e.g. shared-hosting containers) can proxy browser requests to a
 * public API domain but cannot reach that same public origin from inside the
 * container. Set INTERNAL_API_URL to an origin the frontend container can
 * reach directly (e.g. an internal service URL or http://127.0.0.1:3000 when
 * the API runs in-process). Falls back to getServerApiUrl() when unset.
 */
export async function getInternalApiUrl(): Promise<string> {
  const raw = readEnv('INTERNAL_API_URL');
  if (raw) return normalizeApiOrigin(raw);
  return getServerApiUrl();
}
