/**
 * Normalise an attacker-controllable `?redirect=` value into a same-origin path.
 *
 * Anything that could leave this origin, or bounce back into the auth flow,
 * collapses to the fallback. Used by the login page, the axios 401 interceptor
 * and the middleware, so a single definition governs every redirect we honour.
 */

// Control characters (CR/LF/NUL/tab) can split headers or defeat the checks below.
// eslint-disable-next-line no-control-regex
const CONTROL_CHARS = /[\u0000-\u001f\u007f]/;

const AUTH_PATH = /^\/(?:[a-z]{2}\/)?auth\//;

export function safeRedirect(raw: string | null | undefined, fallback = '/dashboard'): string {
  if (!raw) return fallback;

  // Must be a rooted path. Rejecting these textually *before* parsing matters:
  // `new URL('/\\evil.com', base)` normalises the backslash to a slash, so a
  // protocol-relative payload written with a backslash would survive an
  // origin-only check.
  if (!raw.startsWith('/')) return fallback;
  if (raw.startsWith('//') || raw.startsWith('/\\')) return fallback;
  if (CONTROL_CHARS.test(raw)) return fallback;

  try {
    const base = 'http://localhost.invalid';
    const url = new URL(raw, base);
    if (url.origin !== base) return fallback;

    // Never redirect back into auth pages — that produces a login loop.
    if (AUTH_PATH.test(url.pathname)) return fallback;

    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return fallback;
  }
}
