'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { Calendar, MapPin, Search } from 'lucide-react';
import { motion } from 'framer-motion';
import { api } from '@/lib/api';
import { formatDate, formatCurrency, cn } from '@/lib/utils';

interface Event {
  id: string;
  title: string;
  description?: string;
  location?: string;
  startDatetime: string;
  endDatetime: string;
  ticketPrice: number;
  maxTickets?: number;
  imageUrl?: string;
  isPublished: boolean;
}

interface EventsResponse {
  data: Event[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export default function EventsPage() {
  const [search, setSearch] = useState('');
  const [upcoming, setUpcoming] = useState(true);

  const { data, isLoading } = useQuery<EventsResponse>({
    queryKey: ['events', 'list', search, upcoming],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (search) params.set('search', search);
      params.set('upcoming', String(upcoming));
      const { data } = await api.get<EventsResponse>(`/events?${params.toString()}`);
      return data;
    }
  });

  return (
    <div className="px-4 py-16 md:px-6">
      <div className="mx-auto max-w-6xl">
        <h1 className="section-title">Events</h1>
        <p className="mt-4 text-slate-600 dark:text-slate-400">
          Upcoming gatherings, celebrations, and community activities.
        </p>

        <div className="mt-8 flex flex-col gap-4 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search events..."
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
            Upcoming only
          </label>
        </div>

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

          {data?.data.map((event, index) => (
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
                <h3 className="text-xl font-bold">{event.title}</h3>
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
                    {Number(event.ticketPrice) === 0 ? 'Free' : formatCurrency(event.ticketPrice)}
                  </div>
                </div>
                <Link
                  href={`/events/${event.id}`}
                  className="btn-primary mt-5 block w-full text-center text-sm"
                >
                  View Details
                </Link>
              </div>
            </motion.div>
          ))}
        </div>

        {!isLoading && data?.data.length === 0 && (
          <p className="mt-10 text-center text-slate-600 dark:text-slate-400">
            No events found. Check back soon!
          </p>
        )}
      </div>
    </div>
  );
}
