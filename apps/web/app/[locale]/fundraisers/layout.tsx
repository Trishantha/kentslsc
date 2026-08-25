import type { Metadata } from 'next';
import { fetchFundraisersShareImage } from '@/lib/share-image';

export async function generateMetadata(): Promise<Metadata> {
  const image = await fetchFundraisersShareImage();
  return {
    title: 'Fundraisers',
    description: 'Support fundraising campaigns organised by the Kent Sri Lankan Social Club.',
    openGraph: {
      title: 'Fundraisers | Kent Sri Lankan Social Club',
      description: 'Support fundraising campaigns organised by the Kent Sri Lankan Social Club.',
      images: [image]
    },
    twitter: {
      card: 'summary_large_image',
      title: 'Fundraisers | Kent Sri Lankan Social Club',
      description: 'Support fundraising campaigns organised by the Kent Sri Lankan Social Club.',
      images: [image]
    }
  };
}

export default function FundraisersLayout({
  children
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
