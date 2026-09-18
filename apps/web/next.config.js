const createNextIntlPlugin = require('next-intl/plugin');
const withNextIntl = createNextIntlPlugin('./i18n/request.ts');

/** @type {import('next').NextConfig} */

function hostnameFromEnvUrl(envVar) {
  const url = process.env[envVar];
  if (!url) return undefined;
  try {
    return new URL(url).hostname;
  } catch {
    return undefined;
  }
}

// Server-side only: where the rewrite proxy forwards /api and /uploads.
// Mirrors lib/api-base.ts, which cannot be imported here (CommonJS config).
function normalizeApiOrigin(value) {
  return value
    .replace(/\/api\/?$/, '')
    .replace(/\/$/, '');
}

const isDev = process.env.NODE_ENV === 'development';

const rawApiUrl = process.env.API_PROXY_TARGET ?? process.env.NEXT_PUBLIC_API_URL;
if (!rawApiUrl && !isDev) {
  throw new Error(
    'API_PROXY_TARGET (or NEXT_PUBLIC_API_URL) must be set in production. ' +
    'See docs/hostinger-deployment.md'
  );
}

const apiUrl = normalizeApiOrigin(rawApiUrl ?? 'http://localhost:3001');
const apiHostname = (() => {
  try {
    return new URL(apiUrl).hostname;
  } catch {
    return 'localhost';
  }
})();
const apiProtocol = (() => {
  try {
    return new URL(apiUrl).protocol.slice(0, -1);
  } catch {
    return 'http';
  }
})();
const apiPort = (() => {
  try {
    return new URL(apiUrl).port || (apiProtocol === 'https' ? '443' : '80');
  } catch {
    return '3001';
  }
})();
const supabaseHostname = hostnameFromEnvUrl('SUPABASE_URL');

const remotePatterns = [];

if (isDev) {
  remotePatterns.push(
    { protocol: 'http', hostname: 'localhost' },
    { protocol: 'https', hostname: 'localhost' }
  );
}

if (supabaseHostname) {
  remotePatterns.push({
    protocol: 'https',
    hostname: supabaseHostname
  });
}

// Fallback for local/dev: only allow localhost by default. Add production image
// hosts explicitly above; a wildcard pattern weakens SSRF/CSW protection.

const securityHeaders = [
  {
    key: 'Strict-Transport-Security',
    value: 'max-age=63072000; includeSubDomains; preload'
  },
  {
    key: 'X-Frame-Options',
    value: 'DENY'
  },
  {
    key: 'X-Content-Type-Options',
    value: 'nosniff'
  },
  {
    key: 'Referrer-Policy',
    value: 'strict-origin-when-cross-origin'
  },
  {
    key: 'Permissions-Policy',
    value: 'camera=self, microphone=(), geolocation=()'
  },
  {
    key: 'Content-Security-Policy',
    value: [
      "default-src 'self'",
      "script-src 'self' 'unsafe-eval' 'unsafe-inline' https://js.stripe.com",
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
      `img-src 'self' data: blob:${supabaseHostname ? ` https://${supabaseHostname}` : ''}`,
      "font-src 'self' https://fonts.gstatic.com",
      `connect-src 'self' https://api.stripe.com https://hooks.stripe.com${supabaseHostname ? ` https://${supabaseHostname}` : ''}${isDev ? ' ws://localhost:3000 wss://localhost:3000' : ''}`,
      `media-src 'self'${supabaseHostname ? ` https://${supabaseHostname}` : ''}`,
      "frame-src 'self' https://js.stripe.com https://checkout.stripe.com https://hooks.stripe.com",
      "frame-ancestors 'none'",
      "base-uri 'self'",
      "form-action 'self'"
    ].join('; ')
  },
];

// Public pages: the browser must revalidate (max-age=0) so it never serves
// stale HTML across deployments (which could reference static asset hashes
// that no longer exist), while shared CDN/edge caches may serve the page for
// a short window and revalidate in the background. This mirrors the 60s
// revalidation used by the app's data fetching.
const publicCacheHeaders = [
  {
    key: 'Cache-Control',
    value: 'public, max-age=0, must-revalidate'
  },
  {
    key: 'CDN-Cache-Control',
    value: 's-maxage=60, stale-while-revalidate=300'
  },
  {
    key: 'Cloudflare-CDN-Cache-Control',
    value: 's-maxage=60, stale-while-revalidate=300'
  }
];

// Auth/account areas: never cache. Personalized HTML must not leak through
// shared caches, and stale sessions are a security risk.
const privateCacheHeaders = [
  {
    key: 'Cache-Control',
    value: 'no-store, must-revalidate'
  },
  {
    key: 'CDN-Cache-Control',
    value: 'no-store'
  },
  {
    key: 'Cloudflare-CDN-Cache-Control',
    value: 'no-store'
  }
];

// Routes under locale-prefixed and unprefixed paths that must never be cached.
const privateRoutePatterns = [
  'dashboard',
  'admin',
  'auth',
  'account',
  'checkout',
  'membership/verify',
  'fundraisers/my-campaigns'
];

const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  transpilePackages: ['@kentslsc/shared'],
  images: {
    formats: ['image/avif', 'image/webp'],
    // Cache optimized images in the CDN/edge for an hour. The optimizer
    // response is keyed by the full request URL, so a stale entry after a
    // deployment only means a missed resize optimization, never wrong HTML.
    minimumCacheTTL: 3600,
    remotePatterns
  },
  webpack: (config, { dev }) => {
    if (dev) {
      config.cache = false;
    }
    return config;
  },
  async headers() {
    const localePattern = '(en|si|ta)';
    // NOTE: entries are applied in order and later entries win for duplicate
    // header keys, so the public catch-all comes FIRST and the private
    // no-store rules after it override cache headers on auth/account routes.
    return [
      {
        source: '/:path*',
        headers: [...securityHeaders, ...publicCacheHeaders]
      },
      {
        source: '/api/:path*',
        headers: [...securityHeaders, ...privateCacheHeaders]
      },
      ...privateRoutePatterns.flatMap((route) => [
        {
          source: `/${localePattern}/${route}/:path*`,
          headers: [...securityHeaders, ...privateCacheHeaders]
        },
        {
          source: `/${route}/:path*`,
          headers: [...securityHeaders, ...privateCacheHeaders]
        }
      ])
    ];
  },
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: `${apiUrl}/api/:path*`
      },
      {
        source: '/uploads/:path*',
        destination: `${apiUrl}/uploads/:path*`
      }
    ];
  }
};

module.exports = withNextIntl(nextConfig);
