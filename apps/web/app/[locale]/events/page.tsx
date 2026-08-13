'use client';

import { useState } from 'react';
import { Link } from '@/i18n/routing';
import { useTranslations } from 'next-intl';
import { useQuery } from '@tanstack/react-query';
import { Calendar, MapPin, Search, List } from 'lucide-react';
import { motion } from 'framer-motion';
import { api } from '@/lib/api';
import { formatDate, formatCurrency, cn } from '@/lib/utils';
import EventCalendar from '@/components/events/EventCalendar';
import { EventCategory, eventCategoryLabels, eventCategoryColors } from '@kentslsc/shared';

interface Event {
  id: string;
  title: string;
  description?: string;
  location?: string;
  startDatetime: string;
  endDatetime: string;
  ticketPrice: number;
  isFree: boolean;
  maxTickets?: number;
  imageUrl?: string;
  isPublished: boolean;
  category: EventCategory;
}

interface EventsResponse {
  data: Event[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export default function EventsPage() {
  const t = useTranslations('events');
  const tCommon = useTranslations('common');
  const [search, setSearch] = useState('');
  const [upcoming, setUpcoming] = useState(true);
  const [category, setCategory] = useState<string>('');
  const [view, setView] = useState<'list' | 'calendar'>('list');

  const { data, isLoading } = useQuery<EventsResponse>({
    queryKey: ['events', 'list', search, upcoming, category, view],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (search) params.set('search', search);
      params.set('upcoming', String(upcoming));
      params.set('limit', view === 'calendar' ? '100' : '20');
      if (category) params.set('category', category);
      const { data } = await api.get<EventsResponse>(`/events?${params.toString()}`);
      return data;
    }
  });

  const events = data?.data ?? [];

  const categoryOptions = ['', ...Object.values(EventCategory)];

  return (
    <div className="px-4 py-16 md:px-6">
      <div className="mx-auto max-w-6xl">
        <h1 className="section-title">{t('title')}</h1>
        <p className="mt-4 text-slate-600 dark:text-slate-400">
          {t('subtitle')}
        </p>

        <div className="mt-8 flex flex-col gap-4 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t('searchPlaceholder')}
              className="w-full rounded-xl border border-white/10 bg-white/10 py-2.5 pl-10 pr-4 outline-none dark:bg-black/20"
            />
          </div>
          <label className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300">
            <input
              type="checkbox"
              checked={upcoming}
              onChange={(e) => setUpcoming(e.target.checked)}
              className="h-4 w-4 rounded border-slate-300 text-neon-blue focus:ring-neon-blue"
            />
            {t('upcomingOnly')}
          </label>
        </div>

        <div className="mt-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap gap-2">
            {categoryOptions.map((cat) => {
              const active = category === cat;
              return (
                <button
                  key={cat || 'all'}
                  onClick={() => setCategory(cat)}
                  className={cn(
                    'rounded-full px-3 py-1 text-sm font-medium transition',
                    active
                      ? 'bg-neon-blue text-white'
                      : 'bg-white/5 text-slate-600 hover:bg-white/10 dark:text-slate-300'
                  )}
                >
                  {cat ? eventCategoryLabels[cat as EventCategory] : t('allCategories')}
                </button>
              );
            })}
          </div>

          <div className="flex rounded-xl border border-white/10 bg-white/5 p-1">
            <button
              onClick={() => setView('list')}
              className={cn(
                'flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm font-medium transition',
                view === 'list' ? 'bg-neon-blue text-white' : 'text-slate-600 dark:text-slate-300'
              )}
            >
              <List className="h-4 w-4" /> {t('listView')}
            </button>
            <button
              onClick={() => setView('calendar')}
              className={cn(
                'flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm font-medium transition',
                view === 'calendar' ? 'bg-neon-blue text-white' : 'text-slate-600 dark:text-slate-300'
              )}
            >
              <Calendar className="h-4 w-4" /> {t('calendarView')}
            </button>
          </div>
        </div>

        {view === 'calendar' ? (
          <div className="mt-8">
            <EventCalendar events={events} />
          </div>
        ) : (
          <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {isLoading &&
              Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="glass-card h-80 animate-pulse overflow-hidden">
                  <div className="h-40 bg-slate-200 dark:bg-slate-800" />
                  <div className="space-y-3 p-5">
                    <div className="h-5 w-3/4 rounded bg-slate-200 dark:bg-slate-800" />
                    <div className="h-4 w-1/2 rounded bg-slate-200 dark:bg-slate-800" />
                  </div>
                </div>
              ))}

            {events.map((event, index) => (
              <motion.div
                key={event.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
                className="glass-card group overflow-hidden"
              >
                <div
                  className={cn(
                    'h-40 bg-gradient-to-br',
                    event.imageUrl
                      ? 'bg-cover bg-center'
                      : 'from-neon-blue/30 to-neon-gold/30'
                  )}
                  style={event.imageUrl ? { backgroundImage: `url(${event.imageUrl})` } : undefined}
                />
                <div className="p-5">
                  <div className="flex items-start justify-between gap-3">
                    <h3 className="text-xl font-bold">{event.title}</h3>
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
                  <div className="mt-3 space-y-1.5 text-sm text-slate-600 dark:text-slate-400">
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
                    <div className="font-medium text-slate-800 dark:text-slate-200">
                      {event.isFree || Number(event.ticketPrice) === 0 ? tCommon('free') : formatCurrency(event.ticketPrice)}
                    </div>
                  </div>
                  <Link
                    href={`/events/${event.id}`}
                    className="btn-primary mt-5 block w-full text-center text-sm"
                  >
                    {t('viewDetails')}
                  </Link>
                </div>
              </motion.div>
            ))}
          </div>
        )}

        {!isLoading && events.length === 0 && (
          <p className="mt-10 text-center text-slate-600 dark:text-slate-400">
            {t('noEvents')}
          </p>
        )}
      </div>
    </div>
  );
}
