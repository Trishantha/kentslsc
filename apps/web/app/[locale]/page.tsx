import type { Metadata } from 'next';
import BlockRenderer from '@/components/blocks/BlockRenderer';
import type { HeroBlock, PageBlock } from '@kentslsc/shared';
import {
  fetchBlocksData,
  fetchAllBusinesses,
  fetchBlogPosts,
  fetchBlockEvents,
  fetchForumCategories,
  fetchFundraisers,
  fetchRecentPastEvents
} from '@/lib/server-blocks';
import { DEFAULT_HERO, fetchHeroConfig, type HeroConfig } from '@/lib/hero-config';
import { fetchApiWithOriginFallback } from '@/lib/server-fetch';
import { ServerMessagesProvider } from '@/components/i18n/ServerMessagesProvider';
import { getTranslations } from 'next-intl/server';
import HomePageContent from './HomePageContent';

// Namespaces used by the home page tree (HomePageContent, BlockRenderer
// blocks such as ContactBlock).
const HOME_MESSAGE_NAMESPACES = ['home', 'common', 'contactBlock'];

const FALLBACK_OG_IMAGE = '/opengraph-image';

interface HomePageData {
  blocks?: PageBlock[];
}

async function fetchHomePage(): Promise<HomePageData | null> {
  const result = await fetchApiWithOriginFallback('/api/pages/home', {
    next: { revalidate: 60 }
  });
  if (!result.ok || !result.response.ok) {
    return null;
  }
  return (await result.response.json()) as HomePageData;
}

export async function generateMetadata({
  params
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'home' });
  const heroConfig = await fetchHeroConfig();
  const image = heroConfig?.imageUrl ?? FALLBACK_OG_IMAGE;

  return {
    title: t('title'),
    description: t('subtitle'),
    openGraph: {
      title: t('title'),
      description: t('subtitle'),
      images: [image]
    },
    twitter: {
      card: 'summary_large_image',
      title: t('title'),
      description: t('subtitle'),
      images: [image]
    }
  };
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

async function fetchHomePageContentData() {
  const [upcomingEvents, fundraisers, businesses, blogPosts, forumCategories] =
    await Promise.all([
      fetchBlockEvents(3),
      fetchFundraisers(),
      fetchAllBusinesses(),
      fetchBlogPosts(),
      fetchForumCategories()
    ]);

  // Mirror the previous client behaviour: fall back to recent past events
  // when there are no upcoming ones.
  const events =
    upcomingEvents.length > 0
      ? { events: upcomingEvents, isPast: false }
      : { events: await fetchRecentPastEvents(3), isPast: true };

  return { events, fundraisers, businesses, blogPosts, forumCategories };
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
    const blocksData = await fetchBlocksData(blocks);
    return (
      <ServerMessagesProvider namespaces={HOME_MESSAGE_NAMESPACES}>
        <div className="relative overflow-hidden">
          <BlockRenderer blocks={blocks} blocksData={blocksData} />
        </div>
      </ServerMessagesProvider>
    );
  }

  const contentData = await fetchHomePageContentData();
  return (
    <ServerMessagesProvider namespaces={HOME_MESSAGE_NAMESPACES}>
      <HomePageContent hero={heroConfig ?? DEFAULT_HERO} {...contentData} />
    </ServerMessagesProvider>
  );
}
