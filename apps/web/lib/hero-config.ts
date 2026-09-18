import { unstable_cache } from 'next/cache';
import { fetchApiWithOriginFallback } from './server-fetch';

// Matches the API's own 60s cache TTL: hero edits appear within a minute,
// while HTML stays cacheable at the edge.
const REVALIDATE_SECONDS = 60;

export interface HeroConfig {
  mediaType: 'image' | 'video';
  imageUrl: string | null;
  videoUrl: string | null;
  overlayStyle: 'none' | 'dots' | 'noise' | 'scanlines' | 'vignette';
  overlayOpacity: number;
  videoOverlayOpacity: number;
  videoPlaybackRate: number;
}

export const DEFAULT_HERO: HeroConfig = {
  mediaType: 'video',
  imageUrl: '',
  videoUrl: '/videos/kslsc-hero.webm',
  overlayStyle: 'noise',
  overlayOpacity: 75,
  videoOverlayOpacity: 75,
  videoPlaybackRate: 1
};

async function fetchHeroConfigUncached(): Promise<HeroConfig | null> {
  const result = await fetchApiWithOriginFallback('/api/hero-config', {
    next: { revalidate: REVALIDATE_SECONDS }
  });
  if (!result.ok || !result.response.ok) {
    return null;
  }
  return (await result.response.json()) as HeroConfig;
}

// generateMetadata and page renders both need the hero config. Cache the
// lookup across requests so the two renders share one API call per
// revalidation window instead of each hitting the API independently.
export const fetchHeroConfig = unstable_cache(fetchHeroConfigUncached, ['home-hero-config'], {
  revalidate: REVALIDATE_SECONDS
});
