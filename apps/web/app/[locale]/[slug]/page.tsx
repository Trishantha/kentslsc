import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import BlockRenderer from '@/components/blocks/BlockRenderer';
import { fetchWithRetry } from '@/lib/server-fetch';
import type { PageBlock } from '@kentslsc/shared';
import { serverApiUrl } from '@/lib/api-base';

interface Props {
  params: { slug: string };
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
  const res = await fetchWithRetry(`${serverApiUrl}/api/pages/${slug}`, { next: { revalidate: 60 } });
  if (!res || !res.ok) return null;
  return res.json();
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const page = await fetchPage(params.slug);
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
  const page = await fetchPage(params.slug);
  if (!page) notFound();

  return (
    <div className="relative overflow-hidden">
      <BlockRenderer blocks={page.blocks} />
    </div>
  );
}
