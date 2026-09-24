import type { MetadataRoute } from 'next';
import { fetchWithOriginFallback } from '@/lib/server-api-fetch';
import { routing } from '@/i18n/routing';
import { getFrontendUrl } from '@/lib/env';

interface SitePage {
  slug: string;
  isHome: boolean;
  updatedAt: string;
}

interface BlogPost {
  type?: string;
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
  return fetchWithOriginFallback<T>(`/api${path}`, { next: { revalidate: 86400 } });
}

function asArray<T>(value: T[] | { data?: T[] } | { items?: T[] } | null | undefined): T[] {
  if (Array.isArray(value)) return value;
  if (value && typeof value === 'object') {
    if ('data' in value && Array.isArray((value as { data?: T[] }).data)) {
      return (value as { data?: T[] }).data ?? [];
    }
    if ('items' in value && Array.isArray((value as { items?: T[] }).items)) {
      return (value as { items?: T[] }).items ?? [];
    }
  }
  return [];
}

export const revalidate = 86400;

function withLocales(baseUrl: string, path: string): string[] {
  return routing.locales.map((locale) =>
    locale === routing.defaultLocale ? `${baseUrl}${path}` : `${baseUrl}/${locale}${path}`
  );
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = getFrontendUrl();
  const staticPaths = [
    { path: '/', changeFrequency: 'daily' as const, priority: 1 },
    { path: '/about', changeFrequency: 'monthly' as const, priority: 0.6 },
    { path: '/contact', changeFrequency: 'monthly' as const, priority: 0.6 },
    { path: '/emergency', changeFrequency: 'yearly' as const, priority: 0.7 },
    { path: '/events', changeFrequency: 'daily' as const, priority: 0.8 },
    { path: '/directory', changeFrequency: 'daily' as const, priority: 0.8 },
    { path: '/membership', changeFrequency: 'weekly' as const, priority: 0.8 },
    { path: '/fundraisers', changeFrequency: 'daily' as const, priority: 0.8 },
    { path: '/blog', changeFrequency: 'daily' as const, priority: 0.8 },
    { path: '/auth/register', changeFrequency: 'monthly' as const, priority: 0.7 },
    { path: '/privacy', changeFrequency: 'yearly' as const, priority: 0.3 }
  ];

  const staticRoutes: MetadataRoute.Sitemap = staticPaths.flatMap(({ path, changeFrequency, priority }) =>
    withLocales(baseUrl, path).map((url) => ({
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

  const pageItems = asArray(pages);
  const blogItems = asArray(blogPosts);
  const eventItems = asArray(eventsResult);
  const businessItems = asArray(businesses);
  const fundraiserItems = asArray(fundraisers);

  const pageRoutes: MetadataRoute.Sitemap =
    pageItems.filter((p) => !('isHome' in p && p.isHome)).flatMap((p) =>
      withLocales(baseUrl, `/${(p as SitePage).slug}`).map((url) => ({
        url,
        lastModified: new Date((p as SitePage).updatedAt),
        changeFrequency: 'weekly' as const,
        priority: 0.7
      }))
    );

  const blogRoutes: MetadataRoute.Sitemap =
    blogItems
      .filter((p): p is BlogPost => (p as BlogPost).type === 'blog')
      .flatMap((p) =>
        withLocales(baseUrl, `/blog/${p.slug}`).map((url) => ({
          url,
          lastModified: new Date(p.updatedAt),
          changeFrequency: 'weekly' as const,
          priority: 0.7
        }))
      );

  const eventRoutes: MetadataRoute.Sitemap =
    eventItems.flatMap((e) =>
      withLocales(baseUrl, `/events/${(e as Event).id}`).map((url) => ({
        url,
        lastModified: new Date((e as Event).updatedAt),
        changeFrequency: 'weekly' as const,
        priority: 0.8
      }))
    );

  const directoryRoutes: MetadataRoute.Sitemap =
    businessItems.flatMap((b) =>
      withLocales(baseUrl, `/directory/${(b as Business).id}`).map((url) => ({
        url,
        lastModified: new Date((b as Business).updatedAt),
        changeFrequency: 'weekly' as const,
        priority: 0.7
      }))
    );

  const fundraiserRoutes: MetadataRoute.Sitemap =
    fundraiserItems.flatMap((f) =>
      withLocales(baseUrl, `/fundraisers/${(f as Fundraiser).id}`).map((url) => ({
        url,
        lastModified: new Date((f as Fundraiser).updatedAt),
        changeFrequency: 'weekly' as const,
        priority: 0.8
      }))
    );

  return [
    ...staticRoutes,
    ...pageRoutes,
    ...blogRoutes,
    ...eventRoutes,
    ...directoryRoutes,
    ...fundraiserRoutes
  ];
}
