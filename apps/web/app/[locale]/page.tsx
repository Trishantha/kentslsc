import BlockRenderer from '@/components/blocks/BlockRenderer';
import type { HeroBlock, PageBlock } from '@kentslsc/shared';
import { getServerApiUrl } from '@/lib/api-base';
import { getTranslations } from 'next-intl/server';
import HomePageContent from './HomePageContent';

// Render the home page dynamically so hero-config changes are visible immediately
// after saving in the admin dashboard.
export const dynamic = 'force-dynamic';

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

async function fetchHomePage(): Promise<HomePageData | null> {
  try {
    const apiUrl = await getServerApiUrl();
    const res = await fetch(`${apiUrl}/api/pages/home`, {
      cache: 'no-store'
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
    const apiUrl = await getServerApiUrl();
    const res = await fetch(`${apiUrl}/api/hero-config`, {
      cache: 'no-store'
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
  heroConfig: HeroConfig | null,
  defaults: Pick<HeroBlock, 'title' | 'subtitle' | 'buttonText' | 'buttonUrl'>
): PageBlock[] {
  if (!heroConfig) return blocks;

  return blocks.map((block) => {
    if (block.type !== 'hero') return block;

    const heroBlock = block as HeroBlock;
    const isVideo = heroConfig.mediaType === 'video';

    return {
      ...heroBlock,
      title: heroBlock.title?.trim() ? heroBlock.title : defaults.title,
      subtitle: heroBlock.subtitle?.trim() ? heroBlock.subtitle : defaults.subtitle,
      buttonText: heroBlock.buttonText?.trim() ? heroBlock.buttonText : defaults.buttonText,
      buttonUrl: heroBlock.buttonUrl?.trim() ? heroBlock.buttonUrl : defaults.buttonUrl,
      mediaType: heroConfig.mediaType,
      imageUrl: heroConfig.imageUrl ?? heroBlock.imageUrl,
      videoUrl: heroConfig.videoUrl ?? heroBlock.videoUrl,
      overlayStyle: heroConfig.overlayStyle,
      overlayOpacity: isVideo
        ? heroConfig.videoOverlayOpacity ?? heroConfig.overlayOpacity ?? heroBlock.overlayOpacity
        : heroConfig.overlayOpacity ?? heroBlock.overlayOpacity,
      videoPlaybackRate: heroConfig.videoPlaybackRate ?? heroBlock.videoPlaybackRate ?? 1
    } as PageBlock;
  });
}

  export default async function HomePage({ params }: { params: Promise<{ locale: string }> }) {
    const { locale } = await params;
    const t = await getTranslations({ locale, namespace: 'home' });
  const [homePage, heroConfig] = await Promise.all([fetchHomePage(), fetchHeroConfig()]);

  if (homePage?.blocks && homePage.blocks.length > 0) {
      const blocks = mergeHeroConfigIntoBlocks(homePage.blocks, heroConfig, {
        title: 'Kent Sri Lankan Social Club',
        subtitle: t('subtitle'),
        buttonText: t('becomeMember'),
        buttonUrl: '/membership'
      });
    return (
      <div className="relative overflow-hidden">
        <BlockRenderer blocks={blocks} />
      </div>
    );
  }
  return <HomePageContent />;
}
