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
}

export default function EventCard({
  event,
  index = 0,
  shareUrl,
  viewDetailsLabel,
  soldOutLabel,
  remainingLabel,
  freeLabel,
  shareText = `Join us for "${event.title}" on Kent SLSC`
}: Props) {
  const isSoldOut = typeof event.remainingCount === 'number' && event.remainingCount === 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05 }}
      className="glass-card group flex flex-col overflow-hidden"
    >
      <Link href={`/events/${event.id}`} className="relative block overflow-hidden bg-black/10">
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
            <Calendar className="h-16 w-16 text-slate-400" />
          )}
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

        <Link
          href={`/events/${event.id}`}
          className={cn(
            'btn-primary mt-5 block w-full text-center text-sm',
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
            className="mt-4"
          />
        )}
      </div>
    </motion.div>
  );
}
