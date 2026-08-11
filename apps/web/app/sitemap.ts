import type { MetadataRoute } from 'next';
import { fetchWithRetry } from '@/lib/server-fetch';
import { routing } from '@/i18n/routing';
import { serverApiUrl } from '@/lib/api-base';

const baseUrl = process.env.FRONTEND_URL ?? process.env.NEXT_PUBLIC_FRONTEND_URL ?? 'http://localhost:3000';
const apiUrl = serverApiUrl;

interface SitePage {
  slug: string;
  isHome: boolean;
  updatedAt: string;
}

interface BlogPost {
  slug: string;
  updatedAt: string;
}

interface Event {
  id: string;
  updatedAt: string;
}

interface Business {
  id: string;
  updatedAt: string;
}

interface Fundraiser {
  id: string;
  updatedAt: string;
}

interface ForumCategory {
  id: string;
  updatedAt: string;
}

async function fetchJson<T>(path: string): Promise<T | null> {
  const res = await fetchWithRetry(`${apiUrl}/api${path}`, { next: { revalidate: 86400 } });
  if (!res || !res.ok) return null;
  return res.json();
}

export const revalidate = 86400;

function withLocales(path: string): string[] {
  return routing.locales.map((locale) => `${baseUrl}/${locale}${path}`);
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const staticPaths = [
    { path: '/', changeFrequency: 'daily' as const, priority: 1 },
    { path: '/about', changeFrequency: 'monthly' as const, priority: 0.6 },
    { path: '/contact', changeFrequency: 'monthly' as const, priority: 0.6 },
    { path: '/events', changeFrequency: 'daily' as const, priority: 0.8 },
    { path: '/directory', changeFrequency: 'daily' as const, priority: 0.8 },
    { path: '/fundraisers', changeFrequency: 'daily' as const, priority: 0.8 },
    { path: '/blog', changeFrequency: 'daily' as const, priority: 0.8 },
    { path: '/auth/register', changeFrequency: 'monthly' as const, priority: 0.7 },
    { path: '/privacy', changeFrequency: 'yearly' as const, priority: 0.3 }
  ];

  const staticRoutes: MetadataRoute.Sitemap = staticPaths.flatMap(({ path, changeFrequency, priority }) =>
    withLocales(path).map((url) => ({
      url,
      lastModified: new Date(),
      changeFrequency,
      priority
    }))
  );

  const [pages, blogPosts, eventsResult, businesses, fundraisers] = await Promise.all([
    fetchJson<SitePage[]>('/pages'),
    fetchJson<BlogPost[]>('/blog'),
    fetchJson<{ data: Event[] }>('/events?limit=1000'),
    fetchJson<Business[]>('/directory/businesses'),
    fetchJson<Fundraiser[]>('/fundraisers')
  ]);

  const now = new Date();

  const pageRoutes: MetadataRoute.Sitemap =
    pages?.filter((p) => !p.isHome).flatMap((p) =>
      withLocales(`/${p.slug}`).map((url) => ({
        url,
        lastModified: new Date(p.updatedAt),
        changeFrequency: 'weekly' as const,
        priority: 0.7
      }))
    ) ?? [];

  const blogRoutes: MetadataRoute.Sitemap =
    blogPosts?.flatMap((p) =>
      withLocales(`/blog/${p.slug}`).map((url) => ({
        url,
        lastModified: new Date(p.updatedAt),
        changeFrequency: 'weekly' as const,
        priority: 0.7
      }))
    ) ?? [];

  const eventRoutes: MetadataRoute.Sitemap =
    eventsResult?.data.flatMap((e) =>
      withLocales(`/events/${e.id}`).map((url) => ({
        url,
        lastModified: new Date(e.updatedAt),
        changeFrequency: 'weekly' as const,
        priority: 0.8
      }))
    ) ?? [];

  const directoryRoutes: MetadataRoute.Sitemap =
    businesses?.flatMap((b) =>
      withLocales(`/directory/${b.id}`).map((url) => ({
        url,
        lastModified: new Date(b.updatedAt),
        changeFrequency: 'weekly' as const,
        priority: 0.7
      }))
    ) ?? [];

  const fundraiserRoutes: MetadataRoute.Sitemap =
    fundraisers?.flatMap((f) =>
      withLocales(`/fundraisers/${f.id}`).map((url) => ({
        url,
        lastModified: new Date(f.updatedAt),
        changeFrequency: 'weekly' as const,
        priority: 0.8
      }))
    ) ?? [];

  return [
    ...staticRoutes,
    ...pageRoutes,
    ...blogRoutes,
    ...eventRoutes,
    ...directoryRoutes,
    ...fundraiserRoutes
  ];
}
