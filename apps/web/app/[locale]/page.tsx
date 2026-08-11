import dynamic from 'next/dynamic';
import BlockRenderer from '@/components/blocks/BlockRenderer';
import type { HeroBlock, PageBlock } from '@kentslsc/shared';
import { serverApiUrl } from '@/lib/api-base';

const HomePageContent = dynamic(() => import('./HomePageContent'), {
  ssr: false,
  loading: () => (
    <div className="flex h-96 items-center justify-center">
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-slate-300 border-t-neon-blue" />
    </div>
  )
});

export const revalidate = 60;

interface HomePageData {
  blocks?: PageBlock[];
}

interface HeroConfig {
  mediaType: 'image' | 'video';
  imageUrl: string | null;
  videoUrl: string | null;
  overlayStyle: 'none' | 'dots' | 'noise' | 'scanlines' | 'vignette';
  overlayOpacity: number;
  videoOverlayOpacity: number;
  videoPlaybackRate: number;
}

const apiUrl = serverApiUrl;

async function fetchHomePage(): Promise<HomePageData | null> {
  try {
    const res = await fetch(`${apiUrl}/api/pages/home`, {
      next: { revalidate: 60 }
    });
    if (!res.ok) {
      return null;
    }
    return (await res.json()) as HomePageData;
  } catch {
    return null;
  }
}

async function fetchHeroConfig(): Promise<HeroConfig | null> {
  try {
    const res = await fetch(`${apiUrl}/api/hero-config`, {
      next: { revalidate: 60 }
    });
    if (!res.ok) {
      return null;
    }
    return (await res.json()) as HeroConfig;
  } catch {
    return null;
  }
}

function mergeHeroConfigIntoBlocks(
  blocks: PageBlock[],
  heroConfig: HeroConfig | null
): PageBlock[] {
  if (!heroConfig) return blocks;

  return blocks.map((block) => {
    if (block.type !== 'hero') return block;

    const heroBlock = block as HeroBlock;
    const isVideo = heroConfig.mediaType === 'video';

    return {
      ...heroBlock,
      mediaType: heroConfig.mediaType,
      imageUrl: heroConfig.imageUrl ?? heroBlock.imageUrl,
      videoUrl: heroConfig.videoUrl ?? heroBlock.videoUrl,
      overlayStyle: heroConfig.overlayStyle,
      overlayOpacity: isVideo
        ? heroConfig.videoOverlayOpacity ?? heroConfig.overlayOpacity ?? heroBlock.overlayOpacity
        : heroConfig.overlayOpacity ?? heroBlock.overlayOpacity
    } as PageBlock;
  });
}

export default async function HomePage() {
  const [homePage, heroConfig] = await Promise.all([fetchHomePage(), fetchHeroConfig()]);

  if (homePage?.blocks && homePage.blocks.length > 0) {
    const blocks = mergeHeroConfigIntoBlocks(homePage.blocks, heroConfig);
    return (
      <div className="relative overflow-hidden">
        <BlockRenderer blocks={blocks} />
      </div>
    );
  }
  return <HomePageContent />;
}
