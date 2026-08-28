'use client';

import { useMemo, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { cn } from '@/lib/utils';
import EventCard from '@/components/events/EventCard';
import { EventCategory, eventCategoryLabels, eventCategoryColors } from '@kentslsc/shared';

interface MonthEvent {
  id: string;
  title: string;
  location?: string;
  startDatetime: string;
  ticketPrice: number;
  isFree: boolean;
  imageUrl?: string;
  category?: EventCategory;
  remainingCount?: number | null;
}

interface Props {
  events: MonthEvent[];
  shareBaseUrl?: string;
  viewDetailsLabel: string;
  startingFromLabel: (price: string) => string;
  freeLabel: string;
}

function getMonthKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

function getDateKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function formatMonthYear(date: Date) {
  return new Intl.DateTimeFormat('en-GB', { month: 'long', year: 'numeric' }).format(date);
}

function formatFullDate(date: Date) {
  return new Intl.DateTimeFormat('en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  }).format(date);
}

function AgendaEventCard({ event, index }: { event: MonthEvent; index: number }) {
  const router = useRouter();
  const start = new Date(event.startDatetime);
  const day = start.getDate();
  const weekday = start.toLocaleDateString('en-GB', { weekday: 'short' }).toUpperCase();
  const monthShort = start.toLocaleDateString('en-GB', { month: 'short' }).toUpperCase();
  const year = start.getFullYear();

  return (
    <div
      onClick={() => router.push(`/events/${event.id}`)}
      className="group flex cursor-pointer items-center gap-3 rounded-xl bg-white/5 p-3 ring-1 ring-white/10 transition hover:bg-white/10"
    >
      {/* Date block */}
      <div className="flex h-[72px] w-14 shrink-0 flex-col items-center justify-center rounded-lg bg-slate-900 text-center text-white">
        <span className="text-[10px] font-bold uppercase tracking-wider text-neon-blue">
          {weekday}
        </span>
        <span className="text-2xl font-bold leading-none">{day}</span>
        <span className="text-[9px] font-semibold uppercase tracking-wide text-slate-300">
          {monthShort} {year}
        </span>
      </div>

      {/* Poster */}
      <div className="h-[72px] w-14 shrink-0 overflow-hidden rounded-lg bg-slate-800">
        {event.imageUrl ? (
          <img
            src={event.imageUrl}
            alt={event.title}
            className="h-full w-full object-cover transition duration-300 group-hover:scale-105"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-neon-blue/30 to-neon-gold/30">
            <span className="text-2xl font-bold text-slate-400">{day}</span>
          </div>
        )}
      </div>

      {/* Info */}
      <div className="min-w-0 flex-1">
        {event.category && (
          <span
            className={cn(
              'inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold',
              eventCategoryColors[event.category]
            )}
          >
            {eventCategoryLabels[event.category]}
          </span>
        )}
        <h3 className="line-clamp-2 text-sm font-bold leading-tight group-hover:text-neon-blue">
          {event.title}
        </h3>
      </div>
    </div>
  );
}

export default function EventMonthView({
  events,
  shareBaseUrl = '',
  viewDetailsLabel,
  startingFromLabel,
  freeLabel
}: Props) {
  const [origin, setOrigin] = useState(shareBaseUrl);

  useEffect(() => {
    if (typeof window !== 'undefined' && !shareBaseUrl) {
      setOrigin(window.location.origin);
    }
  }, [shareBaseUrl]);

  const groupedByMonth = useMemo(() => {
    const map = new Map<string, MonthEvent[]>();
    for (const event of events) {
      const d = new Date(event.startDatetime);
      const key = getMonthKey(d);
      const list = map.get(key) ?? [];
      list.push(event);
      map.set(key, list);
    }
    const sortedKeys = Array.from(map.keys()).sort();
    return sortedKeys.map((key) => {
      const list = map.get(key)!;
      list.sort((a, b) => new Date(a.startDatetime).getTime() - new Date(b.startDatetime).getTime());
      return { key, monthDate: new Date(list[0]!.startDatetime), events: list };
    });
  }, [events]);

  const groupedByDate = useMemo(() => {
    const map = new Map<string, MonthEvent[]>();
    for (const event of events) {
      const d = new Date(event.startDatetime);
      const key = getDateKey(d);
      const list = map.get(key) ?? [];
      list.push(event);
      map.set(key, list);
    }
    const sortedKeys = Array.from(map.keys()).sort();
    return sortedKeys.map((key) => {
      const list = map.get(key)!;
      list.sort((a, b) => new Date(a.startDatetime).getTime() - new Date(b.startDatetime).getTime());
      return { key, date: new Date(list[0]!.startDatetime), events: list };
    });
  }, [events]);

  if (groupedByMonth.length === 0) {
    return (
      <p className="mt-10 text-center text-slate-600 dark:text-slate-400">
        No events found. Check back soon!
      </p>
    );
  }

  return (
    <>
      {/* Mobile agenda */}
      <div className="space-y-6 md:hidden">
        {groupedByDate.map(({ date, events: dateEvents }) => (
          <section key={date.toISOString()}>
            <div className="mb-2 flex items-center gap-3">
              <h2 className="text-lg font-bold">{formatFullDate(date)}</h2>
              <div className="h-px flex-1 bg-slate-200 dark:bg-slate-700" />
            </div>
            <div className="space-y-3">
              {dateEvents.map((event, index) => (
                <AgendaEventCard key={event.id} event={event} index={index} />
              ))}
            </div>
          </section>
        ))}
      </div>

      {/* Desktop month grid */}
      <div className="mt-10 hidden space-y-14 md:block">
        {groupedByMonth.map(({ monthDate, events: monthEvents }, sectionIndex) => (
          <section key={`${monthDate.getFullYear()}-${monthDate.getMonth()}`}>
            <div className="mb-6 flex items-center gap-4">
              <h2 className="text-2xl font-bold md:text-3xl">{formatMonthYear(monthDate)}</h2>
              <div className="h-px flex-1 bg-slate-200 dark:bg-slate-700" />
              <span className="text-sm font-medium text-slate-500 dark:text-slate-400">
                {monthEvents.length} event{monthEvents.length !== 1 ? 's' : ''}
              </span>
            </div>

            <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
              {monthEvents.map((event, index) => (
                <EventCard
                  key={event.id}
                  event={event}
                  index={sectionIndex * 10 + index}
                  shareUrl={`${origin}/events/${event.id}`}
                  viewDetailsLabel={viewDetailsLabel}
                  startingFromLabel={startingFromLabel}
                  freeLabel={freeLabel}
                  shareText={`Join us for "${event.title}" on Kent SLSC`}
                />
              ))}
            </div>
          </section>
        ))}
      </div>
    </>
  );
}
