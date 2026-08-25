import type { Metadata } from 'next';
import { fetchBlogShareImage } from '@/lib/share-image';

export async function generateMetadata(): Promise<Metadata> {
  const image = await fetchBlogShareImage();
  return {
    title: 'Blog',
    description: 'Read the latest news, stories, and updates from the Kent Sri Lankan Social Club.',
    openGraph: {
      title: 'Blog | Kent Sri Lankan Social Club',
      description: 'Read the latest news, stories, and updates from the Kent Sri Lankan Social Club.',
      images: [image]
    },
    twitter: {
      card: 'summary_large_image',
      title: 'Blog | Kent Sri Lankan Social Club',
      description: 'Read the latest news, stories, and updates from the Kent Sri Lankan Social Club.',
      images: [image]
    }
  };
}

export default function BlogLayout({
  children
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
