'use client';

import { useRouter } from 'next/navigation';
import { Calendar, MapPin } from 'lucide-react';
import { motion } from 'framer-motion';
import { Link } from '@/i18n/routing';
import { formatCurrency, formatDate, cn } from '@/lib/utils';
import { ShareButtons } from '@/components/ui/ShareButtons';
import EventLocationLink from '@/components/events/EventLocationLink';
import { EventCategory, eventCategoryLabels, eventCategoryColors } from '@kentslsc/shared';

interface EventCardEvent {
  id: string;
  title: string;
  location?: string;
  startDatetime: string;
  ticketPrice: number;
  isFree: boolean;
  imageUrl?: string;
  category?: EventCategory;
}

interface Props {
  event: EventCardEvent;
  index?: number;
  shareUrl?: string;
  viewDetailsLabel: string;
  startingFromLabel: (price: string) => string;
  freeLabel: string;
  shareText?: string;
}

export default function EventCard({
  event,
  index = 0,
  shareUrl,
  viewDetailsLabel,
  startingFromLabel,
  freeLabel,
  shareText = `Join us for "${event.title}" on Kent SLSC`
}: Props) {
  const router = useRouter();
  const start = new Date(event.startDatetime);
  const dayOfWeek = start.toLocaleDateString('en-GB', { weekday: 'short' });
  const dayNumber = start.getDate();
  const monthShort = start.toLocaleDateString('en-GB', { month: 'short' });

  const handleCardClick = () => {
    router.push(`/events/${event.id}`);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05 }}
      onClick={handleCardClick}
      className="glass-card group relative flex cursor-pointer flex-col overflow-hidden rounded-2xl sm:h-[340px] sm:flex-row"
    >
      {/* Left column: poster + date block */}
      <div className="relative flex w-full flex-col overflow-hidden bg-slate-100 dark:bg-slate-950 sm:h-full sm:w-[42%]">
        {/* Poster */}
        <div className="relative flex aspect-[3/4] flex-1 items-center justify-center overflow-hidden p-3 sm:aspect-auto">
          {event.imageUrl ? (
            <img
              src={event.imageUrl}
              alt={event.title}
              className="h-full w-full object-contain"
            />
          ) : (
            <div className="flex h-full w-full flex-col items-center justify-center bg-gradient-to-br from-neon-blue/30 to-neon-gold/30">
              <span className="text-5xl font-bold text-slate-400">{dayNumber}</span>
            </div>
          )}

          {event.category && (
            <span
              className={cn(
                'absolute right-2 top-2 rounded-full px-2.5 py-1 text-[10px] font-semibold shadow-md',
                eventCategoryColors[event.category]
              )}
            >
              {eventCategoryLabels[event.category]}
            </span>
          )}
        </div>

        {/* Date block */}
        <div className="flex h-[110px] shrink-0 flex-col items-center justify-center border-t border-slate-200 bg-white text-center text-slate-900 backdrop-blur-sm dark:border-white/10 dark:bg-slate-900/90 dark:text-white">
          <span className="text-xs font-bold uppercase tracking-[0.15em] text-neon-blue">
            {monthShort}
          </span>
          <span className="text-3xl font-bold leading-none md:text-4xl">{dayNumber}</span>
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-300">
            {dayOfWeek}
          </span>
        </div>
      </div>

      {/* Right column: event info */}
      <div className="flex min-w-0 flex-1 flex-col justify-between p-4 sm:h-full sm:p-5">
        <div className="min-h-0">
          <h3 className="line-clamp-2 text-sm font-bold leading-tight group-hover:text-neon-blue sm:text-base">
            {event.title}
          </h3>

          <div className="mt-2 flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400">
            <Calendar className="h-4 w-4 shrink-0 text-neon-blue" />
            <span>{formatDate(event.startDatetime)}</span>
          </div>

          {event.location && (
            <div
              className="mt-2 flex items-start gap-2 text-sm text-slate-600 dark:text-slate-400"
              onClick={(e) => e.stopPropagation()}
            >
              <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-neon-gold" />
              <EventLocationLink location={event.location} className="line-clamp-2 text-sm" showIcon={false} />
            </div>
          )}

          <div className="mt-2 text-sm font-semibold text-slate-800 dark:text-slate-200">
            {event.isFree || Number(event.ticketPrice) === 0
              ? freeLabel
              : startingFromLabel(formatCurrency(event.ticketPrice))}
          </div>
        </div>

        <div className="flex flex-col gap-2 pt-2">
          <Link
            href={`/events/${event.id}`}
            onClick={(e) => e.stopPropagation()}
            className="btn-primary block w-full py-2.5 text-center text-sm"
          >
            {viewDetailsLabel}
          </Link>

          {shareUrl && (
            <ShareButtons
              url={shareUrl}
              title={event.title}
              shareText={shareText}
              compact
            />
          )}
        </div>
      </div>
    </motion.div>
  );
}
