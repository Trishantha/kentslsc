import type { Metadata } from 'next';
import JsonLd from '@/components/JsonLd';
import EventDetailContent, { type Event } from './EventDetailContent';
import { fetchWithOriginFallback } from '@/lib/server-api-fetch';
import { summarizeRichText, stripRichText } from '@/lib/rich-text';
import { getFrontendUrl } from '@/lib/env';

interface Props {
  params: Promise<{ id: string }>;
}

async function fetchEvent(id: string): Promise<Event | null> {
  return fetchWithOriginFallback(`/api/events/${id}`);
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const event = await fetchEvent(id);
  if (!event) return {};
  const description = summarizeRichText(event.description, 160) || `Join us for ${event.title}`;
  const image = event.imageUrl ?? '/opengraph-image';
  return {
    title: event.title,
    description,
    openGraph: {
      title: event.title,
      description,
      type: 'article',
      images: [image]
    },
    twitter: {
      card: 'summary_large_image',
      title: event.title,
      description,
      images: [image]
    },
    alternates: {
      canonical: `/events/${event.id}`
    }
  };
}

export default async function EventDetailPage({ params }: Props) {
  const { id } = await params;
  const event = await fetchEvent(id);

  if (!event) {
    return <EventDetailContent id={id} />;
  }

  const baseUrl = getFrontendUrl();
  const eventSchema = {
    '@context': 'https://schema.org',
    '@type': 'Event',
    name: event.title,
    description: stripRichText(event.description) || `Join us for ${event.title}`,
    image: event.imageUrl ?? `${baseUrl}/opengraph-image`,
    startDate: event.startDatetime,
    endDate: event.endDatetime,
    location: event.location
      ? { '@type': 'Place', name: event.location }
      : { '@type': 'Place', name: 'Kent Sri Lankan Social Club' },
    organizer: {
      '@type': 'Organization',
      name: 'Kent Sri Lankan Social Club',
      url: baseUrl
    },
    offers: {
      '@type': 'Offer',
      price: event.isFree || Number(event.ticketPrice) === 0 ? 0 : Number(event.ticketPrice),
      priceCurrency: 'GBP',
      availability: 'https://schema.org/InStock',
      url: `${baseUrl}/events/${event.id}`
    },
    url: `${baseUrl}/events/${event.id}`
  };

  return (
    <>
      <JsonLd data={eventSchema} />
      <EventDetailContent id={id} event={event} />
    </>
  );
}
