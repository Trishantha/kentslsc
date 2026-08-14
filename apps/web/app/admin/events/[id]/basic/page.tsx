import { fetchWithOriginFallback } from '@/lib/server-api-fetch';
import { notFound } from 'next/navigation';
import { BasicEventForm } from './BasicEventForm';
import type { AdminEvent } from '../../page';

interface Props {
  params: Promise<{ id: string }>;
}

async function getEvent(id: string): Promise<AdminEvent | null> {
  return fetchWithOriginFallback(`/api/events/${id}`);
}

export default async function BasicEventPage({ params }: Props) {
  const { id } = await params;
  const event = await getEvent(id);
  if (!event) notFound();

  return (
    <div className="max-w-3xl">
      <BasicEventForm event={event} eventId={id} />
    </div>
  );
}
