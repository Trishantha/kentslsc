import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import BlockRenderer from '@/components/blocks/BlockRenderer';
import { fetchWithOriginFallback } from '@/lib/server-api-fetch';
import { fetchBlocksData } from '@/lib/server-blocks';
import { ServerMessagesProvider } from '@/components/i18n/ServerMessagesProvider';
import type { PageBlock } from '@kentslsc/shared';

// CMS pages render arbitrary block trees; the only client-side translations
// come from ContactBlock. 'common' is included as a safety margin for future
// blocks.
const SLUG_MESSAGE_NAMESPACES = ['contactBlock', 'common'];

interface Props {
  params: Promise<{ slug: string }>;
}

interface SitePage {
  id: string;
  slug: string;
  title: string;
  metaDescription: string | null;
  ogImageUrl: string | null;
  blocks: PageBlock[];
  isPublished: boolean;
}

function findFirstImage(blocks: PageBlock[]): string | undefined {
  for (const block of blocks) {
    if (block.type === 'hero' && block.mediaType === 'image' && block.imageUrl) {
      return block.imageUrl;
    }
    if (block.type === 'image' && block.imageUrl) {
      return block.imageUrl;
    }
  }
  return undefined;
}

async function fetchPage(slug: string): Promise<SitePage | null> {
  return fetchWithOriginFallback<SitePage>(`/api/pages/${slug}`, { next: { revalidate: 60 } });
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const page = await fetchPage(slug);
  if (!page) return {};
  const description = page.metaDescription ?? undefined;
  const ogImage = page.ogImageUrl ?? findFirstImage(page.blocks) ?? '/opengraph-image';
  return {
    title: page.title,
    description,
    openGraph: {
      title: page.title,
      description,
      images: [ogImage]
    },
    twitter: {
      card: 'summary_large_image',
      title: page.title,
      description,
      images: [ogImage]
    },
    alternates: {
      canonical: `/${page.slug}`
    }
  };
}

export default async function CustomPage({ params }: Props) {
  const { slug } = await params;
  const page = await fetchPage(slug);
  if (!page) notFound();

  const blocksData = await fetchBlocksData(page.blocks);

  return (
    <ServerMessagesProvider namespaces={SLUG_MESSAGE_NAMESPACES}>
      <div className="relative overflow-hidden">
        <BlockRenderer blocks={page.blocks} blocksData={blocksData} />
      </div>
    </ServerMessagesProvider>
  );
}
