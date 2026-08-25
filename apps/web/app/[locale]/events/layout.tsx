import type { Metadata } from 'next';
import { fetchEventsShareImage } from '@/lib/share-image';

export async function generateMetadata(): Promise<Metadata> {
  const image = await fetchEventsShareImage();
  return {
    title: 'Events',
    description: 'Discover upcoming events and celebrations hosted by the Kent Sri Lankan Social Club.',
    openGraph: {
      title: 'Events | Kent Sri Lankan Social Club',
      description: 'Discover upcoming events and celebrations hosted by the Kent Sri Lankan Social Club.',
      images: [image]
    },
    twitter: {
      card: 'summary_large_image',
      title: 'Events | Kent Sri Lankan Social Club',
      description: 'Discover upcoming events and celebrations hosted by the Kent Sri Lankan Social Club.',
      images: [image]
    }
  };
}

export default function EventsLayout({
  children
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
