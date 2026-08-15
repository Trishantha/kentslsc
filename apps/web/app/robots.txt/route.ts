import { NextResponse } from 'next/server';
import { getFrontendUrl } from '@/lib/env';

export async function GET() {
  const baseUrl = getFrontendUrl();
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
