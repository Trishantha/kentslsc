import { unstable_cache } from 'next/cache';
import type { EventCategory, MixedBlogListItem, PageBlock } from '@kentslsc/shared';
import { fetchApiWithOriginFallback } from './server-fetch';

// Matches the API's own 60s cache TTL: content edits appear within a minute,
// while HTML stays cacheable at the edge.
const REVALIDATE_SECONDS = 60;

export interface BlockEventItem {
  id: string;
  title: string;
  description?: string;
  location?: string;
  startDatetime: string;
  imageUrl?: string;
  ticketPrice: number;
  isFree: boolean;
  category?: EventCategory;
  externalTicketingUrl?: string | null;
}

export interface BlockBusinessItem {
  id: string;
  businessName: string;
  description?: string;
  logoUrl?: string;
  category?: string;
  isPromoted?: boolean;
}

export interface BlockFundraiserItem {
  id: string;
  title: string;
  description?: string;
  targetAmount: number;
  raisedAmount: number;
  imageUrl?: string;
  aiSummary?: string;
}

export interface BlockForumCategory {
  id: string;
  name: string;
  description?: string | null;
}

async function fetchBlockEventsUncached(limit?: number): Promise<BlockEventItem[]> {
  const params = new URLSearchParams({ upcoming: 'true' });
  if (limit !== undefined) params.set('limit', String(limit));
  const result = await fetchApiWithOriginFallback(`/api/events?${params}`, {
    next: { revalidate: REVALIDATE_SECONDS }
  });
  if (!result.ok || !result.response.ok) return [];
  const body = (await result.response.json()) as { data?: BlockEventItem[] };
  return body.data ?? [];
}

async function fetchRecentPastEventsUncached(limit: number): Promise<BlockEventItem[]> {
  const result = await fetchApiWithOriginFallback(
    `/api/events?upcoming=false&limit=${limit}`,
    { next: { revalidate: REVALIDATE_SECONDS } }
  );
  if (!result.ok || !result.response.ok) return [];
  const body = (await result.response.json()) as { data?: BlockEventItem[] };
  return body.data ?? [];
}

async function fetchPromotedBusinessesUncached(limit?: number): Promise<BlockBusinessItem[]> {
  const params = new URLSearchParams({ promoted: 'true' });
  if (limit !== undefined) params.set('limit', String(limit));
  const result = await fetchApiWithOriginFallback(`/api/directory/businesses?${params}`, {
    next: { revalidate: REVALIDATE_SECONDS }
  });
  if (!result.ok || !result.response.ok) return [];
  return (await result.response.json()) as BlockBusinessItem[];
}

async function fetchAllBusinessesUncached(): Promise<BlockBusinessItem[]> {
  const result = await fetchApiWithOriginFallback('/api/directory/businesses', {
    next: { revalidate: REVALIDATE_SECONDS }
  });
  if (!result.ok || !result.response.ok) return [];
  return (await result.response.json()) as BlockBusinessItem[];
}

async function fetchBlogPostsUncached(limit?: number): Promise<MixedBlogListItem[]> {
  const path = limit !== undefined ? `/api/blog?limit=${limit}` : '/api/blog';
  const result = await fetchApiWithOriginFallback(path, {
    next: { revalidate: REVALIDATE_SECONDS }
  });
  if (!result.ok || !result.response.ok) return [];
  return (await result.response.json()) as MixedBlogListItem[];
}

async function fetchFundraisersUncached(limit?: number): Promise<BlockFundraiserItem[]> {
  const path = limit !== undefined ? `/api/fundraisers?limit=${limit}` : '/api/fundraisers';
  const result = await fetchApiWithOriginFallback(path, {
    next: { revalidate: REVALIDATE_SECONDS }
  });
  if (!result.ok || !result.response.ok) return [];
  const body = (await result.response.json()) as { items?: BlockFundraiserItem[] };
  return body.items ?? [];
}

async function fetchForumCategoriesUncached(): Promise<BlockForumCategory[]> {
  const result = await fetchApiWithOriginFallback('/api/forum/categories', {
    next: { revalidate: REVALIDATE_SECONDS }
  });
  if (!result.ok || !result.response.ok) return [];
  return (await result.response.json()) as BlockForumCategory[];
}

export const fetchBlockEvents = unstable_cache(fetchBlockEventsUncached, ['block-events'], {
  revalidate: REVALIDATE_SECONDS
});
export const fetchRecentPastEvents = unstable_cache(fetchRecentPastEventsUncached, ['block-past-events'], {
  revalidate: REVALIDATE_SECONDS
});
export const fetchPromotedBusinesses = unstable_cache(
  fetchPromotedBusinessesUncached,
  ['block-promoted-businesses'],
  { revalidate: REVALIDATE_SECONDS }
);
export const fetchAllBusinesses = unstable_cache(fetchAllBusinessesUncached, ['block-all-businesses'], {
  revalidate: REVALIDATE_SECONDS
});
export const fetchBlogPosts = unstable_cache(fetchBlogPostsUncached, ['block-blog-posts'], {
  revalidate: REVALIDATE_SECONDS
});
export const fetchFundraisers = unstable_cache(fetchFundraisersUncached, ['block-fundraisers'], {
  revalidate: REVALIDATE_SECONDS
});
export const fetchForumCategories = unstable_cache(fetchForumCategoriesUncached, ['block-forum-categories'], {
  revalidate: REVALIDATE_SECONDS
});

/**
 * Prefetch server-side data for every data-driven block in a page's block
 * list, keyed by block id. Pages pass the result through BlockRenderer so
 * blocks render with data in the initial HTML instead of fetching after
 * hydration. Blocks missing from the map fall back to client-side fetching
 * (e.g. the admin page preview, where no server prefetch happened).
 */
export async function fetchBlocksData(blocks: PageBlock[]): Promise<Record<string, unknown>> {
  const entries = await Promise.all(
    blocks.map(async (block) => {
      const limit = 'limit' in block ? (block.limit as number | undefined) : undefined;
      switch (block.type) {
        case 'events':
          return [block.id, await fetchBlockEvents(limit)] as const;
        case 'directory':
          return [block.id, await fetchPromotedBusinesses(limit)] as const;
        case 'blog':
          return [block.id, await fetchBlogPosts(limit)] as const;
        case 'fundraisers':
          return [block.id, await fetchFundraisers(limit)] as const;
        default:
          return null;
      }
    })
  );
  return Object.fromEntries(entries.filter((e): e is NonNullable<typeof e> => e !== null));
}
