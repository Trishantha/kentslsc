import { NextResponse } from 'next/server';

const baseUrl = process.env.FRONTEND_URL ?? process.env.NEXT_PUBLIC_FRONTEND_URL ?? 'http://localhost:3000';

export async function GET() {
  const body = [
    'User-agent: *',
    'Allow: /',
    'Disallow: /admin',
    'Disallow: /auth',
    'Disallow: /dashboard',
    'Disallow: /api',
    'Disallow: /_next',
    `Sitemap: ${baseUrl}/sitemap.xml`,
    ''
  ].join('\n');

  return new NextResponse(body, {
    headers: { 'Content-Type': 'text/plain' }
  });
}
