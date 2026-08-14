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

export const serverApiUrl = normalizeApiOrigin(rawApiUrl ?? 'http://localhost:3001');

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
