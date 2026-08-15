'use client';

import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { Loader2, Calendar, QrCode, ArrowRight } from 'lucide-react';
import { api } from '@/lib/api';
import { formatDate } from '@/lib/utils';

interface EventItem {
  id: string;
  title: string;
  startDatetime: string;
  endDatetime: string;
  location?: string;
  isPublished: boolean;
}

export default function TicketScanLandingPage() {
  const { data, isLoading } = useQuery<{ data: EventItem[] }>({
    queryKey: ['events', 'published'],
    queryFn: async () => {
      const res = await api.get('/events');
      return res.data;
    }
  });

  const events = data?.data ?? [];
  const upcoming = events.filter((e) => new Date(e.endDatetime) >= new Date());
  const past = events.filter((e) => new Date(e.endDatetime) < new Date());

  return (
    <div className="max-w-3xl">
      <h2 className="text-lg font-bold">Ticket scanner</h2>
      <p className="text-sm text-slate-500">
        Choose an event to scan tickets at the entrance.
      </p>

      {isLoading ? (
        <div className="mt-8 flex h-40 items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-neon-blue" />
        </div>
      ) : events.length === 0 ? (
        <div className="mt-8 rounded-2xl border border-dashed border-white/10 bg-white/5 p-10 text-center text-sm text-slate-500">
          <QrCode className="mx-auto h-10 w-10 text-slate-600" />
          <p className="mt-4 font-medium">No published events</p>
          <p className="mt-1">Create and publish an event to start scanning tickets.</p>
          <Link href="/admin/events" className="btn-primary mt-6 inline-flex items-center gap-2">
            Go to events
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      ) : (
        <div className="mt-6 space-y-6">
          {upcoming.length > 0 && (
            <section>
              <h3 className="mb-3 text-sm font-semibold uppercase tracking-wider text-slate-500">
                Upcoming & current events
              </h3>
              <div className="space-y-3">
                {upcoming.map((event) => (
                  <EventScanCard key={event.id} event={event} />
                ))}
              </div>
            </section>
          )}

          {past.length > 0 && (
            <section>
              <h3 className="mb-3 text-sm font-semibold uppercase tracking-wider text-slate-500">
                Past events
              </h3>
              <div className="space-y-3">
                {past.map((event) => (
                  <EventScanCard key={event.id} event={event} />
                ))}
              </div>
            </section>
          )}
        </div>
      )}
    </div>
  );
}

function EventScanCard({ event }: { event: EventItem }) {
  const hasEnded = new Date(event.endDatetime) < new Date();

  return (
    <Link
      href={`/admin/events/${event.id}/scanner`}
      className="flex items-center justify-between gap-4 rounded-2xl border border-white/10 bg-white/5 p-4 transition-colors hover:bg-white/10"
    >
      <div className="min-w-0">
        <p className="font-semibold">{event.title}</p>
        <p className="mt-1 flex items-center gap-2 text-xs text-slate-500">
          <Calendar className="h-3.5 w-3.5" />
          {formatDate(event.startDatetime)}
        </p>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <span
          className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
            hasEnded
              ? 'bg-amber-500/10 text-amber-400'
              : 'bg-green-500/10 text-green-400'
          }`}
        >
          {hasEnded ? 'Ended' : 'Open'}
        </span>
        <QrCode className="h-5 w-5 text-slate-500" />
      </div>
    </Link>
  );
}
