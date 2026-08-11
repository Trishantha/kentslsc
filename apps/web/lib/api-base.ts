// Absolute origin of the API, for server-side use only (server components,
// sitemap, and the rewrite proxy in next.config.js).
//
// Client code must NOT use this. The browser talks to the API through the
// relative `/api` path (see lib/api.ts), which next.config.js rewrites to this
// origin. Keeping browser requests same-origin is what makes the app work
// behind a proxied host such as a GitHub Codespace, where `localhost` in the
// browser refers to the user's own machine rather than the server.
export const serverApiUrl = (
  process.env.API_PROXY_TARGET ??
  process.env.NEXT_PUBLIC_API_URL ??
  'http://localhost:3001'
).replace(/\/$/, '');
