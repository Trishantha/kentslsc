import { fetchWithOriginFallback } from './server-api-fetch';

const FALLBACK_OG_IMAGE = '/opengraph-image';

interface EventListItem {
  imageUrl?: string;
}

interface BlogListItem {
  imageUrl?: string;
}

interface BusinessListItem {
  logoUrl?: string;
}

interface FundraiserListItem {
  imageUrl?: string;
}

export async function fetchEventsShareImage(): Promise<string> {
  const response = await fetchWithOriginFallback<{ data: EventListItem[] }>(
    '/api/events?upcoming=true&limit=20',
    { next: { revalidate: 60 } }
  );
  const image = response?.data?.find((item) => item.imageUrl)?.imageUrl;
  return image || FALLBACK_OG_IMAGE;
}

export async function fetchBlogShareImage(): Promise<string> {
  const response = await fetchWithOriginFallback<BlogListItem[]>('/api/blog', {
    next: { revalidate: 60 }
  });
  const image = response?.find((item) => item.imageUrl)?.imageUrl;
  return image || FALLBACK_OG_IMAGE;
}

export async function fetchDirectoryShareImage(): Promise<string> {
  const response = await fetchWithOriginFallback<BusinessListItem[]>(
    '/api/directory/businesses',
    { next: { revalidate: 60 } }
  );
  const image = response?.find((item) => item.logoUrl)?.logoUrl;
  return image || FALLBACK_OG_IMAGE;
}

export async function fetchFundraisersShareImage(): Promise<string> {
  const response = await fetchWithOriginFallback<{ items: FundraiserListItem[] }>(
    '/api/fundraisers?limit=20',
    { next: { revalidate: 60 } }
  );
  const image = response?.items?.find((item) => item.imageUrl)?.imageUrl;
  return image || FALLBACK_OG_IMAGE;
}
