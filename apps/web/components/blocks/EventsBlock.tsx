'use client';

import Image from 'next/image';
import { SmartLink } from '@/components/ui/SmartLink';
import { useQuery } from '@tanstack/react-query';
import { Calendar, ArrowRight } from 'lucide-react';
import { api } from '@/lib/api';
import { formatDate, formatCurrency, cn } from '@/lib/utils';
import { FadeIn } from '@/components/ui/FadeIn';
import EventLocationLink from '@/components/events/EventLocationLink';
import type { BlockEventItem } from '@/lib/server-blocks';
import type { EventsBlock } from '@kentslsc/shared';
import { EventCategory, eventCategoryLabels, eventCategoryColors } from '@kentslsc/shared';

interface Props {
  block: EventsBlock;
  /** Server-prefetched events (keyed by block id). Falls back to client fetching. */
  data?: BlockEventItem[];
}

interface EventItem extends BlockEventItem {}

export default function EventsBlockComponent({ block, data }: Props) {
  const { title, limit = 3 } = block;

  const { data: fetched, isLoading } = useQuery<EventItem[]>({
    queryKey: ['blocks', 'events', limit],
    queryFn: async () => {
      const { data } = await api.get('/events', { params: { upcoming: true, limit } });
      return data?.data ?? [];
    },
    enabled: data === undefined
  });

  const events = data ?? fetched ?? [];
  const showLoading = data === undefined && isLoading;

  return (
    <section className="px-4 py-16 md:px-6">
      <div className="mx-auto max-w-7xl">
        <div className="mb-8 flex items-end justify-between">
          <div>
            {title && <h2 className="section-title">{title}</h2>}
          </div>
          <SmartLink href="/events" className="hidden text-sm font-semibold text-neon-blue sm:inline-flex">
            View all <ArrowRight className="ml-1 h-4 w-4" />
          </SmartLink>
        </div>

        {showLoading ? (
          <div className="grid gap-6 md:grid-cols-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="glass-card h-80 animate-pulse" />
            ))}
          </div>
        ) : events.length === 0 ? (
          <p className="text-slate-600 dark:text-slate-400">No upcoming events right now.</p>
        ) : (
          <div className="grid gap-4">
            {events.slice(0, limit).map((event, index) => (
              <FadeIn key={event.id} delay={index * 0.05}>
                <SmartLink href={`/events/${event.id}`}>
                  <div className="glass-card group flex flex-col overflow-hidden sm:flex-row">
                    <div
                      className={cn(
                        'relative flex aspect-[3/4] w-full items-center justify-center overflow-hidden bg-gradient-to-br',
                        event.imageUrl ? 'from-black/5 to-black/10' : 'from-neon-blue/40 to-neon-gold/40'
                      )}
                    >
                      {event.imageUrl ? (
                        <Image
                          src={event.imageUrl}
                          alt={event.title}
                          fill
                          sizes="(min-width: 640px) 320px, 100vw"
                          className="object-contain"
                        />
                      ) : (
                        <Calendar className="h-12 w-12 text-slate-400" />
                      )}
                    </div>
                    <div className="flex flex-1 flex-col p-5">
                      <div className="flex items-start justify-between gap-3">
                        <h3 className="text-base font-bold group-hover:text-neon-blue sm:text-lg">{event.title}</h3>
                        {event.category && (
                          <span
                            className={cn(
                              'shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium',
                              eventCategoryColors[event.category]
                            )}
                          >
                            {eventCategoryLabels[event.category]}
                          </span>
                        )}
                      </div>
                      <div className="mt-2 space-y-1 text-sm text-slate-700 dark:text-slate-400">
                        <div className="flex items-center gap-2">
                          <Calendar className="h-4 w-4 text-neon-blue" />
                          {formatDate(event.startDatetime)}
                        </div>
                        {event.location && (
                          <EventLocationLink location={event.location} />
                        )}
                      </div>
                      <div className="mt-2 font-medium">
                        {event.externalTicketingUrl
                          ? 'External tickets'
                          : event.isFree || Number(event.ticketPrice) === 0
                            ? 'Free'
                            : formatCurrency(event.ticketPrice)}
                      </div>
                    </div>
                  </div>
                </SmartLink>
              </FadeIn>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
