'use client';

import { SmartLink } from '@/components/ui/SmartLink';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { Calendar, MapPin, ArrowRight } from 'lucide-react';
import { api } from '@/lib/api';
import { formatDate, formatCurrency, cn } from '@/lib/utils';
import type { EventsBlock } from '@kentslsc/shared';
import { EventCategory, eventCategoryLabels, eventCategoryColors } from '@kentslsc/shared';

interface Props {
  block: EventsBlock;
}

interface EventItem {
  id: string;
  title: string;
  description?: string;
  location?: string;
  startDatetime: string;
  imageUrl?: string;
  ticketPrice: number;
  isFree: boolean;
  category?: EventCategory;
}

export default function EventsBlockComponent({ block }: Props) {
  const { title, limit = 3 } = block;

  const { data: events = [], isLoading } = useQuery<EventItem[]>({
    queryKey: ['blocks', 'events', limit],
    queryFn: async () => {
      const { data } = await api.get('/events', { params: { upcoming: true, limit } });
      return data?.data ?? [];
    }
  });

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

        {isLoading ? (
          <div className="grid gap-6 md:grid-cols-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="glass-card h-80 animate-pulse" />
            ))}
          </div>
        ) : events.length === 0 ? (
          <p className="text-slate-600 dark:text-slate-400">No upcoming events right now.</p>
        ) : (
          <div className="grid gap-6 md:grid-cols-3">
            {events.slice(0, limit).map((event, index) => (
              <motion.div
                key={event.id}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.05 }}
              >
                <SmartLink href={`/events/${event.id}`}>
                  <div className="glass-card group overflow-hidden">
                    <div
                      className={cn(
                        'h-40 bg-gradient-to-br',
                        event.imageUrl ? 'bg-cover bg-center' : 'from-neon-blue/40 to-neon-gold/40'
                      )}
                      style={event.imageUrl ? { backgroundImage: `url(${event.imageUrl})` } : undefined}
                    />
                    <div className="p-5">
                      <div className="flex items-start justify-between gap-3">
                        <h3 className="text-lg font-bold group-hover:text-neon-blue">{event.title}</h3>
                        {event.category && (
                          <span
                            className={cn(
                              'shrink-0 rounded-full px-2 py-0.5 text-xs font-medium',
                              eventCategoryColors[event.category]
                            )}
                          >
                            {eventCategoryLabels[event.category]}
                          </span>
                        )}
                      </div>
                      <div className="mt-3 space-y-1 text-sm text-slate-700 dark:text-slate-400">
                        <div className="flex items-center gap-2">
                          <Calendar className="h-4 w-4 text-neon-blue" />
                          {formatDate(event.startDatetime)}
                        </div>
                        {event.location && (
                          <div className="flex items-center gap-2">
                            <MapPin className="h-4 w-4 text-neon-gold" />
                            {event.location}
                          </div>
                        )}
                      </div>
                      <div className="mt-3 font-medium">
                        {event.isFree || Number(event.ticketPrice) === 0 ? 'Free' : formatCurrency(event.ticketPrice)}
                      </div>
                    </div>
                  </div>
                </SmartLink>
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
