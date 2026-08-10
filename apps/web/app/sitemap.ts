import type { MetadataRoute } from 'next';
import { fetchWithRetry } from '@/lib/server-fetch';

const baseUrl = process.env.FRONTEND_URL ?? process.env.NEXT_PUBLIC_FRONTEND_URL ?? 'http://localhost:3000';
const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

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

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const staticRoutes: MetadataRoute.Sitemap = [
    { url: `${baseUrl}/`, lastModified: new Date(), changeFrequency: 'daily', priority: 1 },
    { url: `${baseUrl}/about`, changeFrequency: 'monthly', priority: 0.6 },
    { url: `${baseUrl}/contact`, changeFrequency: 'monthly', priority: 0.6 },
    { url: `${baseUrl}/events`, changeFrequency: 'daily', priority: 0.8 },
    { url: `${baseUrl}/directory`, changeFrequency: 'daily', priority: 0.8 },
    { url: `${baseUrl}/fundraisers`, changeFrequency: 'daily', priority: 0.8 },
    { url: `${baseUrl}/blog`, changeFrequency: 'daily', priority: 0.8 },
    { url: `${baseUrl}/forum`, changeFrequency: 'daily', priority: 0.7 },
    { url: `${baseUrl}/auth/register`, changeFrequency: 'monthly', priority: 0.7 },
    { url: `${baseUrl}/privacy`, changeFrequency: 'yearly', priority: 0.3 }
  ];

  const [pages, blogPosts, eventsResult, businesses, fundraisers, forumCategories] = await Promise.all([
    fetchJson<SitePage[]>('/pages'),
    fetchJson<BlogPost[]>('/blog'),
    fetchJson<{ data: Event[] }>('/events?limit=1000'),
    fetchJson<Business[]>('/directory/businesses'),
    fetchJson<Fundraiser[]>('/fundraisers'),
    fetchJson<ForumCategory[]>('/forum/categories')
  ]);

  const pageRoutes: MetadataRoute.Sitemap =
    pages?.filter((p) => !p.isHome).map((p) => ({
      url: `${baseUrl}/${p.slug}`,
      lastModified: new Date(p.updatedAt),
      changeFrequency: 'weekly',
      priority: 0.7
    })) ?? [];

  const blogRoutes: MetadataRoute.Sitemap =
    blogPosts?.map((p) => ({
      url: `${baseUrl}/blog/${p.slug}`,
      lastModified: new Date(p.updatedAt),
      changeFrequency: 'weekly',
      priority: 0.7
    })) ?? [];

  const eventRoutes: MetadataRoute.Sitemap =
    eventsResult?.data.map((e) => ({
      url: `${baseUrl}/events/${e.id}`,
      lastModified: new Date(e.updatedAt),
      changeFrequency: 'weekly',
      priority: 0.8
    })) ?? [];

  const directoryRoutes: MetadataRoute.Sitemap =
    businesses?.map((b) => ({
      url: `${baseUrl}/directory/${b.id}`,
      lastModified: new Date(b.updatedAt),
      changeFrequency: 'weekly',
      priority: 0.7
    })) ?? [];

  const fundraiserRoutes: MetadataRoute.Sitemap =
    fundraisers?.map((f) => ({
      url: `${baseUrl}/fundraisers/${f.id}`,
      lastModified: new Date(f.updatedAt),
      changeFrequency: 'weekly',
      priority: 0.8
    })) ?? [];

  const forumCategoryRoutes: MetadataRoute.Sitemap =
    forumCategories?.map((c) => ({
      url: `${baseUrl}/forum/categories/${c.id}`,
      lastModified: new Date(c.updatedAt),
      changeFrequency: 'weekly',
      priority: 0.6
    })) ?? [];

  return [
    ...staticRoutes,
    ...pageRoutes,
    ...blogRoutes,
    ...eventRoutes,
    ...directoryRoutes,
    ...fundraiserRoutes,
    ...forumCategoryRoutes
  ];
}
