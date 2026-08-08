import dynamic from 'next/dynamic';
import BlockRenderer from '@/components/blocks/BlockRenderer';
import type { PageBlock } from '@kentslsc/shared';

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

async function fetchHomePage(): Promise<HomePageData | null> {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';
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

export default async function HomePage() {
  const homePage = await fetchHomePage();
  if (homePage?.blocks && homePage.blocks.length > 0) {
    return (
      <div className="relative overflow-hidden">
        <BlockRenderer blocks={homePage.blocks} />
      </div>
    );
  }
  return <HomePageContent />;
}
