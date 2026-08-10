import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { fetchWithRetry } from '@/lib/server-fetch';
import JsonLd from '@/components/JsonLd';
import EventDetailContent, { type Event } from './EventDetailContent';

interface Props {
  params: { id: string };
}

async function fetchEvent(id: string): Promise<Event | null> {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';
  const res = await fetchWithRetry(`${apiUrl}/api/events/${id}`, { next: { revalidate: 60 } });
  if (!res || !res.ok) return null;
  return res.json();
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const event = await fetchEvent(params.id);
  if (!event) return {};
  const description = event.description?.slice(0, 160).replace(/\n/g, ' ') ?? `Join us for ${event.title}`;
  const image = event.imageUrl ?? '/opengraph-image.png';
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
  const event = await fetchEvent(params.id);
  if (!event) notFound();

  const baseUrl = process.env.FRONTEND_URL ?? process.env.NEXT_PUBLIC_FRONTEND_URL ?? 'http://localhost:3000';
  const eventSchema = {
    '@context': 'https://schema.org',
    '@type': 'Event',
    name: event.title,
    description: event.description ?? `Join us for ${event.title}`,
    image: event.imageUrl ?? `${baseUrl}/opengraph-image.png`,
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
      price: Number(event.ticketPrice),
      priceCurrency: 'GBP',
      availability: 'https://schema.org/InStock',
      url: `${baseUrl}/events/${event.id}`
    },
    url: `${baseUrl}/events/${event.id}`
  };

  return (
    <>
      <JsonLd data={eventSchema} />
      <EventDetailContent event={event} />
    </>
  );
}
