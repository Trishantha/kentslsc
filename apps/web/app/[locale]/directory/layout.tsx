import type { Metadata } from 'next';
import { fetchDirectoryShareImage } from '@/lib/share-image';

export async function generateMetadata(): Promise<Metadata> {
  const image = await fetchDirectoryShareImage();
  return {
    title: 'Directory',
    description: 'Discover Sri Lankan businesses and job opportunities in Kent.',
    openGraph: {
      title: 'Directory | Kent Sri Lankan Social Club',
      description: 'Discover Sri Lankan businesses and job opportunities in Kent.',
      images: [image]
    },
    twitter: {
      card: 'summary_large_image',
      title: 'Directory | Kent Sri Lankan Social Club',
      description: 'Discover Sri Lankan businesses and job opportunities in Kent.',
      images: [image]
    }
  };
}

export default function DirectoryLayout({
  children
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
