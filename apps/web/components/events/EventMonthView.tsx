'use client';

import { useMemo, useEffect, useState } from 'react';
import { Calendar, MapPin } from 'lucide-react';
import { motion } from 'framer-motion';
import { Link } from '@/i18n/routing';
import { formatDate, formatCurrency, cn } from '@/lib/utils';
import { ShareButtons } from '@/components/ui/ShareButtons';
import EventLocationLink from '@/components/events/EventLocationLink';
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
      {grouped.map(({ key, monthDate, events: monthEvents }, sectionIndex) => (
        <section key={key}>
          <div className="mb-6 flex items-center gap-4">
            <h2 className="text-2xl font-bold md:text-3xl">{formatMonthYear(monthDate)}</h2>
            <div className="h-px flex-1 bg-slate-200 dark:bg-slate-700" />
            <span className="text-sm font-medium text-slate-500 dark:text-slate-400">
              {monthEvents.length} event{monthEvents.length !== 1 ? 's' : ''}
            </span>
          </div>

          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {monthEvents.map((event, index) => {
              const start = new Date(event.startDatetime);
              const dayOfWeek = new Intl.DateTimeFormat('en-GB', { weekday: 'short' }).format(start);
              const dayNumber = start.getDate();
              const monthShort = new Intl.DateTimeFormat('en-GB', { month: 'short' }).format(start);
              const shareUrl = `${origin}/events/${event.id}`;
              const isSoldOut = typeof event.remainingCount === 'number' && event.remainingCount === 0;

              return (
                <motion.div
                  key={event.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: sectionIndex * 0.1 + index * 0.05 }}
                  className="glass-card group flex flex-col overflow-hidden"
                >
                  <Link href={`/events/${event.id}`} className="relative block overflow-hidden bg-black/10">
                    <div
                      className={cn(
                        'flex aspect-[3/4] items-center justify-center bg-gradient-to-br p-0',
                        event.imageUrl ? 'from-black/5 to-black/10' : 'from-neon-blue/30 to-neon-gold/30'
                      )}
                    >
                      {event.imageUrl ? (
                        <img
                          src={event.imageUrl}
                          alt={event.title}
                          className="h-full w-full object-contain"
                        />
                      ) : (
                        <Calendar className="h-16 w-16 text-slate-400" />
                      )}
                    </div>

                    <div className="absolute bottom-3 left-3 flex flex-col items-center rounded-xl border border-white/10 bg-slate-950/80 px-3 py-2 text-center text-white shadow-lg backdrop-blur-sm">
                      <span className="text-[10px] font-semibold uppercase tracking-wider text-neon-blue">
                        {dayOfWeek}
                      </span>
                      <span className="text-2xl font-bold leading-none md:text-3xl">
                        {dayNumber}
                      </span>
                      <span className="text-[10px] font-medium uppercase tracking-wider text-slate-300">
                        {monthShort}
                      </span>
                    </div>

                    {event.category && (
                      <span
                        className={cn(
                          'absolute right-3 top-3 rounded-full px-2.5 py-1 text-xs font-medium shadow-md',
                          eventCategoryColors[event.category]
                        )}
                      >
                        {eventCategoryLabels[event.category]}
                      </span>
                    )}
                  </Link>

                  <div className="flex flex-1 flex-col p-5">
                    <h3 className="text-lg font-bold leading-tight group-hover:text-neon-blue md:text-xl">
                      {event.title}
                    </h3>

                    <div className="mt-3 space-y-1.5 text-sm text-slate-600 dark:text-slate-400">
                      <div className="flex items-center gap-2">
                        <Calendar className="h-4 w-4 text-neon-blue" />
                        {formatDate(event.startDatetime)}
                      </div>
                      {event.location && (
                        <div className="flex items-start gap-2">
                          <MapPin className="mt-0.5 h-4 w-4 text-neon-blue" />
                          <EventLocationLink location={event.location} />
                        </div>
                      )}
                      <div className="font-medium text-slate-800 dark:text-slate-200">
                        {event.isFree || Number(event.ticketPrice) === 0 ? freeLabel : formatCurrency(event.ticketPrice)}
                      </div>
                      {typeof event.remainingCount === 'number' && (
                        <div
                          className={cn(
                            'text-xs font-medium',
                            event.remainingCount <= 5 ? 'text-red-500' : 'text-slate-500 dark:text-slate-400'
                          )}
                        >
                          {isSoldOut ? soldOutLabel : remainingLabel(event.remainingCount)}
                        </div>
                      )}
                    </div>

                    <div className="mt-4 flex items-center justify-between">
                      <Link
                        href={`/events/${event.id}`}
                        className={cn(
                          'btn-primary flex-1 text-center text-sm',
                          isSoldOut && 'pointer-events-none opacity-60'
                        )}
                      >
                        {isSoldOut ? soldOutLabel : viewDetailsLabel}
                      </Link>
                    </div>

                    <ShareButtons
                      url={shareUrl}
                      title={event.title}
                      shareText={`Join us for "${event.title}" on Kent SLSC`}
                      compact
                      className="mt-4"
                    />
                  </div>
                </motion.div>
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );
}
