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

const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';
const apiHostname = hostnameFromEnvUrl('NEXT_PUBLIC_API_URL') ?? 'localhost';
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
    return '4000';
  }
})();
const isDev = process.env.NODE_ENV === 'development';
const supabaseHostname = hostnameFromEnvUrl('SUPABASE_URL');

const remotePatterns = [
  {
    protocol: 'http',
    hostname: 'localhost'
  },
  {
    protocol: 'https',
    hostname: '**'
  }
];

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

module.exports = nextConfig;
