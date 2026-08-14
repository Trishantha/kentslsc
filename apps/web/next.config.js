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

const remotePatterns = [
  {
    protocol: 'https',
    hostname: '**'
  }
];

if (isDev) {
  remotePatterns.push({
    protocol: 'http',
    hostname: 'localhost'
  });
}

if (supabaseHostname) {
  remotePatterns.push({
    protocol: 'https',
    hostname: supabaseHostname
  });
}

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
    value: 'camera=(), microphone=(), geolocation=()'
  },
  {
    key: 'Content-Security-Policy',
    value: [
      "default-src 'self'",
      "script-src 'self' 'unsafe-eval' 'unsafe-inline'",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: https:",
      "font-src 'self'",
      `connect-src 'self' https:${isDev ? ` ws://localhost:3000 wss://localhost:3000 ${apiProtocol}://${apiHostname}:${apiPort}` : ''}`,
      "media-src 'self' https:",
      "frame-ancestors 'none'",
      "base-uri 'self'",
      "form-action 'self'"
    ].join('; ')
  }
];

const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  eslint: {
    ignoreDuringBuilds: true
  },
  transpilePackages: ['@kentslsc/shared'],
  images: {
    formats: ['image/avif', 'image/webp'],
    remotePatterns
  },
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: securityHeaders
      }
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
