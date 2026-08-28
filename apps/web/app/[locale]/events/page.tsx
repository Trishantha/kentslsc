'use client';

import { useState, useEffect, useMemo } from 'react';
import { useTranslations } from 'next-intl';
import { useQuery } from '@tanstack/react-query';
import { Calendar as CalendarIcon, Search, List, SlidersHorizontal } from 'lucide-react';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';
import EventCard from '@/components/events/EventCard';
import EventPosterCard from '@/components/events/EventPosterCard';
import EventMonthView from '@/components/events/EventMonthView';
import { EventCategory, eventCategoryLabels } from '@kentslsc/shared';

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
  soldCount?: number;
  remainingCount?: number | null;
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
  const tDetail = useTranslations('eventDetail');
  const [search, setSearch] = useState('');
  const [upcoming, setUpcoming] = useState(true);
  const [category, setCategory] = useState<string>('');
  const [view, setView] = useState<'list' | 'calendar'>('list');
  const [showMobileFilters, setShowMobileFilters] = useState(false);
  const [origin, setOrigin] = useState('');

  useEffect(() => {
    if (typeof window !== 'undefined') {
      setOrigin(window.location.origin);
    }
  }, []);

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

  const events = useMemo(() => data?.data ?? [], [data?.data]);

  const categoryOptions = ['', ...Object.values(EventCategory)];

  const eventsByCategory = useMemo(() => {
    const map = new Map<string, Event[]>();
    for (const event of events) {
      const list = map.get(event.category) ?? [];
      list.push(event);
      map.set(event.category, list);
    }
    return Array.from(map.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([cat, list]) => [
        cat,
        list.sort((x, y) => new Date(x.startDatetime).getTime() - new Date(y.startDatetime).getTime())
      ] as const);
  }, [events]);

  return (
    <div className="px-4 py-16 md:px-6">
      <div className="mx-auto max-w-[1600px]">
        <h1 className="section-title">{t('title')}</h1>

        {/* Desktop filters */}
        <div className="mt-6 hidden flex-col gap-4 md:flex md:flex-row md:items-center">
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

        <div className="mt-6 hidden flex-col gap-4 md:flex md:flex-row md:items-center md:justify-between">
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

          <div className="flex overflow-hidden rounded-full border border-slate-300 dark:border-slate-600">
            <button
              onClick={() => setView('list')}
              aria-label={t('listView')}
              title={t('listView')}
              className={cn(
                'flex h-10 w-12 items-center justify-center transition',
                view === 'list'
                  ? 'bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900'
                  : 'bg-white text-slate-600 hover:bg-slate-100 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800'
              )}
            >
              <List className="h-5 w-5" />
            </button>
            <button
              onClick={() => setView('calendar')}
              aria-label={t('monthView')}
              title={t('monthView')}
              className={cn(
                'flex h-10 w-12 items-center justify-center transition',
                view === 'calendar'
                  ? 'bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900'
                  : 'bg-white text-slate-600 hover:bg-slate-100 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800'
              )}
            >
              <CalendarIcon className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Mobile filters */}
        <div className="mt-4 md:hidden">
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={t('searchPlaceholder')}
                className="w-full rounded-xl border border-white/10 bg-white/10 py-2.5 pl-10 pr-4 outline-none dark:bg-black/20"
              />
            </div>

            <div className="flex shrink-0 overflow-hidden rounded-xl border border-white/10">
              <button
                onClick={() => setView('list')}
                aria-label={t('listView')}
                title={t('listView')}
                className={cn(
                  'flex h-11 w-10 items-center justify-center transition',
                  view === 'list'
                    ? 'bg-neon-blue text-white'
                    : 'bg-white/5 text-slate-600 hover:bg-white/10 dark:text-slate-300'
                )}
              >
                <List className="h-5 w-5" />
              </button>
              <button
                onClick={() => setView('calendar')}
                aria-label={t('monthView')}
                title={t('monthView')}
                className={cn(
                  'flex h-11 w-10 items-center justify-center transition',
                  view === 'calendar'
                    ? 'bg-neon-blue text-white'
                    : 'bg-white/5 text-slate-600 hover:bg-white/10 dark:text-slate-300'
                )}
              >
                <CalendarIcon className="h-5 w-5" />
              </button>
            </div>

            <button
              onClick={() => setShowMobileFilters((s) => !s)}
              aria-label={t('filters')}
              title={t('filters')}
              className={cn(
                'flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-white/10 transition',
                showMobileFilters
                  ? 'bg-neon-gold text-slate-900'
                  : 'bg-white/10 text-slate-600 hover:bg-white/20 dark:text-slate-300'
              )}
            >
              <SlidersHorizontal className="h-5 w-5" />
            </button>
          </div>

          {showMobileFilters && (
            <div className="mt-3 space-y-4 rounded-2xl border border-white/10 bg-white/5 p-4 dark:bg-black/20">
              <label className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300">
                <input
                  type="checkbox"
                  checked={upcoming}
                  onChange={(e) => setUpcoming(e.target.checked)}
                  className="h-4 w-4 rounded border-slate-300 text-neon-blue focus:ring-neon-blue"
                />
                {t('upcomingOnly')}
              </label>

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
            </div>
          )}
        </div>

        {/* Mobile layout */}
        <div className="mt-6 space-y-10 md:hidden">
          {isLoading &&
            Array.from({ length: 3 }).map((_, i) => (
              <div key={i}>
                <div className="mb-3 h-6 w-32 animate-pulse rounded bg-slate-200 dark:bg-slate-800" />
                <div className="flex gap-3 overflow-hidden">
                  {Array.from({ length: 4 }).map((__, j) => (
                    <div
                      key={j}
                      className="h-[220px] w-[165px] shrink-0 animate-pulse rounded-2xl bg-slate-200 dark:bg-slate-800"
                    />
                  ))}
                </div>
              </div>
            ))}

          {!isLoading && view === 'calendar' && (
            <EventMonthView
              events={events}
              shareBaseUrl={origin}
              viewDetailsLabel={t('viewDetails')}
              startingFromLabel={(price) => t('startingFrom', { price })}
              freeLabel={tCommon('free')}
            />
          )}

          {!isLoading && view === 'list' && eventsByCategory.length === 0 && (
            <p className="mt-10 text-center text-slate-600 dark:text-slate-400">
              {t('noEvents')}
            </p>
          )}

          {!isLoading &&
            view === 'list' &&
            eventsByCategory.map(([cat, catEvents], sectionIndex) => (
              <section key={cat}>
                <div className="mb-3 flex items-baseline justify-between">
                  <h2 className="text-lg font-bold">
                    {eventCategoryLabels[cat as EventCategory]}
                  </h2>
                  <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
                    {catEvents.length} {catEvents.length === 1 ? tCommon('event') : tCommon('events')}
                  </span>
                </div>
                <div className="flex gap-3 overflow-x-auto pb-4 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden]">
                  {catEvents.map((event, index) => (
                    <EventPosterCard
                      key={event.id}
                      event={event}
                      index={sectionIndex * 10 + index}
                    />
                  ))}
                </div>
              </section>
            ))}
        </div>

        {/* Desktop layout */}
        <div className="hidden md:block">
          {view === 'calendar' ? (
            <EventMonthView
              events={events}
              shareBaseUrl={origin}
              viewDetailsLabel={t('viewDetails')}
              startingFromLabel={(price) => t('startingFrom', { price })}
              freeLabel={tCommon('free')}
            />
          ) : (
            <div className="mt-10 grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
              {isLoading &&
                Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} className="glass-card flex h-[340px] animate-pulse overflow-hidden">
                    <div className="w-[42%] shrink-0 bg-slate-200 dark:bg-slate-800" />
                    <div className="flex-1 space-y-3 p-5">
                      <div className="h-5 w-3/4 rounded bg-slate-200 dark:bg-slate-800" />
                      <div className="h-4 w-1/2 rounded bg-slate-200 dark:bg-slate-800" />
                      <div className="h-4 w-2/3 rounded bg-slate-200 dark:bg-slate-800" />
                      <div className="h-9 w-full rounded bg-slate-200 dark:bg-slate-800" />
                    </div>
                  </div>
                ))}

              {events.map((event, index) => (
                <EventCard
                  key={event.id}
                  event={event}
                  index={index}
                  shareUrl={`${origin}/events/${event.id}`}
                  viewDetailsLabel={t('viewDetails')}
                  startingFromLabel={(price) => t('startingFrom', { price })}
                  freeLabel={tCommon('free')}
                  shareText={tDetail('shareText', { title: event.title })}
                />
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
    </div>
  );
}
