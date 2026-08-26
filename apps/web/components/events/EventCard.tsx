'use client';

import { Calendar, MapPin } from 'lucide-react';
import { motion } from 'framer-motion';
import { Link } from '@/i18n/routing';
import { formatDate, formatCurrency, cn } from '@/lib/utils';
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
  remainingCount?: number | null;
}

interface Props {
  event: EventCardEvent;
  index?: number;
  shareUrl?: string;
  viewDetailsLabel: string;
  soldOutLabel: string;
  remainingLabel: (count: number) => string;
  freeLabel: string;
  shareText?: string;
  dateOverlay?: boolean;
}

export default function EventCard({
  event,
  index = 0,
  shareUrl,
  viewDetailsLabel,
  soldOutLabel,
  remainingLabel,
  freeLabel,
  shareText = `Join us for "${event.title}" on Kent SLSC`,
  dateOverlay = false
}: Props) {
  const isSoldOut = typeof event.remainingCount === 'number' && event.remainingCount === 0;
  const start = new Date(event.startDatetime);
  const dayOfWeek = start.toLocaleDateString('en-GB', { weekday: 'short' });
  const dayNumber = start.getDate();
  const monthShort = start.toLocaleDateString('en-GB', { month: 'short' });

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05 }}
      className="glass-card group flex flex-col overflow-hidden sm:flex-row"
    >
      <Link
        href={`/events/${event.id}`}
        className="relative block w-full shrink-0 overflow-hidden bg-black/10 sm:w-40 md:w-48"
      >
        <div
          className={cn(
            'flex aspect-[3/4] items-center justify-center bg-gradient-to-br',
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
            <Calendar className="h-12 w-12 text-slate-400" />
          )}
        </div>

        {event.category && (
          <span
            className={cn(
              'absolute right-2 top-2 rounded-full px-2 py-0.5 text-[10px] font-medium shadow-md',
              eventCategoryColors[event.category]
            )}
          >
            {eventCategoryLabels[event.category]}
          </span>
        )}

        {dateOverlay && (
          <div className="absolute bottom-2 left-2 flex flex-col items-center rounded-lg border border-white/10 bg-slate-950/80 px-2 py-1.5 text-center text-white shadow-lg backdrop-blur-sm">
            <span className="text-[9px] font-semibold uppercase tracking-wider text-neon-blue">
              {dayOfWeek}
            </span>
            <span className="text-xl font-bold leading-none">{dayNumber}</span>
            <span className="text-[9px] font-medium uppercase text-slate-300">{monthShort}</span>
          </div>
        )}
      </Link>

      <div className="flex flex-1 flex-col p-4 sm:p-5">
        <h3 className="text-base font-bold leading-tight group-hover:text-neon-blue sm:text-lg">
          {event.title}
        </h3>

        <div className="mt-2 space-y-1 text-sm text-slate-600 dark:text-slate-400">
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

        <div className="mt-auto flex flex-col gap-3 pt-4">
          <Link
            href={`/events/${event.id}`}
            className={cn(
              'btn-primary block w-full text-center text-sm',
              isSoldOut && 'pointer-events-none opacity-60'
            )}
          >
            {isSoldOut ? soldOutLabel : viewDetailsLabel}
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
