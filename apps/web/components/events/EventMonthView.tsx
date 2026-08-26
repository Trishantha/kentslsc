'use client';

import { useMemo, useEffect, useState } from 'react';
import { formatDate, cn } from '@/lib/utils';
import EventCard from '@/components/events/EventCard';
import { EventCategory } from '@kentslsc/shared';

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
  soldOutLabel: string;
  remainingLabel: (count: number) => string;
  freeLabel: string;
}

function getMonthKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

function formatMonthYear(date: Date) {
  return new Intl.DateTimeFormat('en-GB', { month: 'long', year: 'numeric' }).format(date);
}

export default function EventMonthView({
  events,
  shareBaseUrl = '',
  viewDetailsLabel,
  soldOutLabel,
  remainingLabel,
  freeLabel
}: Props) {
  const [origin, setOrigin] = useState(shareBaseUrl);

  useEffect(() => {
    if (typeof window !== 'undefined' && !shareBaseUrl) {
      setOrigin(window.location.origin);
    }
  }, [shareBaseUrl]);

  const grouped = useMemo(() => {
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

  if (grouped.length === 0) {
    return (
      <p className="mt-10 text-center text-slate-600 dark:text-slate-400">
        No events found. Check back soon!
      </p>
    );
  }

  return (
    <div className="mt-10 space-y-14">
      {grouped.map(({ monthDate, events: monthEvents }, sectionIndex) => (
        <section key={`${monthDate.getFullYear()}-${monthDate.getMonth()}`}>
          <div className="mb-6 flex items-center gap-4">
            <h2 className="text-2xl font-bold md:text-3xl">{formatMonthYear(monthDate)}</h2>
            <div className="h-px flex-1 bg-slate-200 dark:bg-slate-700" />
            <span className="text-sm font-medium text-slate-500 dark:text-slate-400">
              {monthEvents.length} event{monthEvents.length !== 1 ? 's' : ''}
            </span>
          </div>

          <div className="grid gap-4">
            {monthEvents.map((event, index) => (
              <EventCard
                key={event.id}
                event={event}
                index={sectionIndex * 10 + index}
                shareUrl={`${origin}/events/${event.id}`}
                viewDetailsLabel={viewDetailsLabel}
                soldOutLabel={soldOutLabel}
                remainingLabel={remainingLabel}
                freeLabel={freeLabel}
                shareText={`Join us for "${event.title}" on Kent SLSC`}
                dateOverlay
              />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
