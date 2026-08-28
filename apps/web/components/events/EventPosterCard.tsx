'use client';

import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { Calendar } from 'lucide-react';
import { cn, formatDate } from '@/lib/utils';
import { EventCategory, eventCategoryLabels, eventCategoryColors } from '@kentslsc/shared';

interface PosterEvent {
  id: string;
  title: string;
  startDatetime: string;
  imageUrl?: string;
  category?: EventCategory;
}

interface Props {
  event: PosterEvent;
  index?: number;
}

export default function EventPosterCard({ event, index = 0 }: Props) {
  const router = useRouter();
  const start = new Date(event.startDatetime);
  const day = start.getDate();

  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.05 }}
      onClick={() => router.push(`/events/${event.id}`)}
      className="group relative w-[150px] shrink-0 cursor-pointer overflow-hidden rounded-xl bg-slate-900 shadow-lg ring-1 ring-white/10"
    >
      <div className="relative aspect-[3/4] w-full overflow-hidden">
        {event.imageUrl ? (
          <img
            src={event.imageUrl}
            alt={event.title}
            className="h-full w-full object-cover transition duration-300 group-hover:scale-105"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-neon-blue/30 to-neon-gold/30">
            <span className="text-4xl font-bold text-slate-400">{day}</span>
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent" />

        {event.category && (
          <span
            className={cn(
              'absolute left-2 top-2 rounded-full px-2 py-0.5 text-[10px] font-semibold shadow-md',
              eventCategoryColors[event.category]
            )}
          >
            {eventCategoryLabels[event.category]}
          </span>
        )}

        <div className="absolute bottom-0 left-0 right-0 p-3">
          <h3 className="line-clamp-2 text-sm font-bold leading-tight text-white group-hover:text-neon-blue">
            {event.title}
          </h3>
          <div className="mt-1 flex items-center gap-1 text-[11px] text-slate-300">
            <Calendar className="h-3 w-3 text-neon-blue" />
            <span>{formatDate(event.startDatetime)}</span>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
