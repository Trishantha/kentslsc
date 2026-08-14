import Link from 'next/link';
import { ArrowLeft, Calendar } from 'lucide-react';
import { fetchWithOriginFallback } from '@/lib/server-api-fetch';
import { notFound } from 'next/navigation';
import { EventDetailTabs } from './EventDetailTabs';
import type { AdminEvent } from '../page';

interface EventDetailLayoutProps {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
}

async function getEvent(id: string): Promise<AdminEvent | null> {
  return fetchWithOriginFallback(`/api/events/${id}`);
}

export default async function EventDetailLayout({ children, params }: EventDetailLayoutProps) {
  const { id } = await params;
  const event = await getEvent(id);
  if (!event) notFound();

  const hasEnded = new Date(event.endDatetime) < new Date();

  return (
    <div>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <Link
            href="/admin/events"
            className="mt-1 rounded-lg p-2 text-slate-500 hover:bg-white/5 hover:text-slate-300"
          >
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div>
            <h1 className="section-title">{event.title}</h1>
            <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-slate-500">
              <Calendar className="h-3.5 w-3.5" />
              <span>{new Date(event.startDatetime).toLocaleString('en-GB')}</span>
              {hasEnded && (
                <span className="rounded-full bg-amber-500/10 px-2 py-0.5 text-xs font-semibold text-amber-400">
                  Event ended
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="mt-4">
        <EventDetailTabs eventId={id} />
      </div>

      {children}
    </div>
  );
}
