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

const rawApiUrl = process.env.API_PROXY_TARGET ?? process.env.NEXT_PUBLIC_API_URL;
const rawInternalApiUrl = process.env.INTERNAL_API_URL;

export const serverApiUrl = normalizeApiOrigin(rawApiUrl ?? 'http://localhost:3001');

/**
 * Internal API origin for server-side calls.
 *
 * Some hosts (e.g. shared-hosting containers) can proxy browser requests to a
 * public API domain but cannot reach that same public origin from inside the
 * container. Set INTERNAL_API_URL to an origin the frontend container can
 * reach directly (e.g. an internal service URL or http://127.0.0.1:3001 when
 * the API runs on the same container). Falls back to serverApiUrl when unset.
 */
export const internalApiUrl = rawInternalApiUrl
  ? normalizeApiOrigin(rawInternalApiUrl)
  : serverApiUrl;

/**
 * Runtime URL for server-side API calls.
 *
 * Server components must call the API through the configured proxy target
 * (API_PROXY_TARGET or NEXT_PUBLIC_API_URL), not through the request's public
 * host header. Using the public host breaks when the frontend and API are
 * separate deployments, and can fail inside shared-hosting containers that
 * cannot reach their own public origin.
 */
export async function getServerApiUrl(): Promise<string> {
  return serverApiUrl;
}

/**
 * Runtime URL for server-side calls that need to reach the API from inside the
 * frontend container. Auth session checks use this so a logged-in user is not
 * bounced back to login because the container cannot resolve the public API URL.
 */
export async function getInternalApiUrl(): Promise<string> {
  return internalApiUrl;
}
