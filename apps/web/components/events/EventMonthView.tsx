'use client';

import { useMemo, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { PartyPopper } from 'lucide-react';
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

function AgendaEventCard({ event }: { event: MonthEvent }) {
  const router = useRouter();
  const start = new Date(event.startDatetime);
  const day = start.getDate();
  const weekday = start.toLocaleDateString('en-GB', { weekday: 'short' }).toUpperCase();
  const monthShort = start.toLocaleDateString('en-GB', { month: 'short' }).toUpperCase();
  const year = start.getFullYear();

  return (
    <div
      onClick={() => router.push(`/events/${event.id}`)}
      className="group relative flex cursor-pointer items-center gap-4 overflow-hidden rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition hover:border-neon-blue/50 dark:border-transparent dark:bg-gradient-to-r dark:from-slate-900 dark:via-slate-900 dark:to-slate-800 dark:shadow-none dark:ring-1 dark:ring-white/10 dark:hover:ring-neon-blue/50"
    >
      {/* Left neon accent */}
      <div className="absolute left-0 top-0 h-full w-1.5 bg-gradient-to-b from-neon-blue via-neon-gold to-neon-blue" />

      {/* Date block */}
      <div className="flex h-[100px] w-20 shrink-0 flex-col items-center justify-center rounded-xl border border-slate-200 bg-slate-50 text-center shadow-sm dark:border-transparent dark:bg-gradient-to-br dark:from-slate-800 dark:to-black dark:shadow-lg">
        <span className="text-[10px] font-extrabold uppercase tracking-widest text-neon-blue">
          {weekday}
        </span>
        <span className="text-2xl font-black leading-none text-slate-900 dark:text-white">{day}</span>
        <span className="text-[9px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-300">
          {monthShort} {year}
        </span>
      </div>

      {/* Poster */}
      <div className="h-[100px] w-20 shrink-0 overflow-hidden rounded-xl ring-1 ring-slate-200 dark:ring-white/10">
        {event.imageUrl ? (
          <img
            src={event.imageUrl}
            alt={event.title}
            className="h-full w-full object-contain transition duration-300 group-hover:scale-110"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-neon-blue/40 to-neon-gold/40">
            <span className="text-3xl font-black text-white/90">{day}</span>
          </div>
        )}
      </div>

      {/* Info */}
      <div className="min-w-0 flex-1">
        {event.category && (
          <span
            className={cn(
              'mb-1 inline-flex rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider',
              eventCategoryColors[event.category]
            )}
          >
            {eventCategoryLabels[event.category]}
          </span>
        )}
        <h3 className="line-clamp-2 text-sm font-semibold leading-snug text-slate-900 group-hover:text-neon-blue dark:text-white">
          <PartyPopper className="mr-1.5 inline h-4 w-4 shrink-0 text-neon-gold" />
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
              <h2 className="text-base font-semibold">{formatFullDate(date)}</h2>
              <div className="h-px flex-1 bg-slate-200 dark:bg-slate-700" />
            </div>
            <div className="space-y-3">
              {dateEvents.map((event) => (
                <AgendaEventCard key={event.id} event={event} />
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
              <h2 className="text-xl font-bold md:text-2xl">{formatMonthYear(monthDate)}</h2>
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
