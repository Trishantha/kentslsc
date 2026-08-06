import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import BlockRenderer from '@/components/blocks/BlockRenderer';
import type { PageBlock } from '@kentslsc/shared';

interface Props {
  params: { slug: string };
}

interface SitePage {
  id: string;
  slug: string;
  title: string;
  metaDescription: string | null;
  blocks: PageBlock[];
  isPublished: boolean;
}

async function fetchPage(slug: string): Promise<SitePage | null> {
  try {
    const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';
    const res = await fetch(`${apiUrl}/api/pages/${slug}`, { cache: 'no-store' });
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const page = await fetchPage(params.slug);
  if (!page) return {};
  return {
    title: page.title,
    description: page.metaDescription ?? undefined
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
