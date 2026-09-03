'use client';

import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { Calendar, Sparkles } from 'lucide-react';
import { cn, formatDate } from '@/lib/utils';
import { EventCategory, eventCategoryLabels, eventCategoryColors } from '@kentslsc/shared';

interface PosterEvent {
  id: string;
  title: string;
  startDatetime: string;
  isFeatured?: boolean;
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
      className="group relative w-[165px] shrink-0 cursor-pointer overflow-hidden rounded-2xl bg-slate-900 shadow-xl ring-1 ring-white/10 transition hover:ring-neon-blue/50"
    >
      {/* Top neon accent */}
      <div className="absolute left-0 right-0 top-0 z-10 h-1 bg-gradient-to-r from-neon-blue via-neon-gold to-neon-blue" />

      <div className="relative aspect-[3/4] w-full overflow-hidden bg-gradient-to-br from-neon-blue/50 via-slate-900 to-neon-gold/50">
        {event.imageUrl ? (
          <img
            src={event.imageUrl}
            alt={event.title}
            className="h-full w-full object-contain transition duration-300 group-hover:scale-110"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center">
            <span className="text-5xl font-black text-white/90">{day}</span>
          </div>
        )}

        {event.category && (
          <span
            className={cn(
              'absolute left-3 top-3 rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider shadow-lg',
              eventCategoryColors[event.category]
            )}
          >
            {eventCategoryLabels[event.category]}
          </span>
        )}

        {event.isFeatured && (
          <span className="absolute right-3 top-3 z-10 inline-flex items-center gap-1 rounded-full bg-neon-gold/90 px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-amber-950 shadow-lg">
            <Sparkles className="h-3 w-3" /> Featured
          </span>
        )}

        <div className="absolute bottom-0 left-0 right-0 p-4">
          <h3 className="line-clamp-2 text-base font-bold leading-snug text-white group-hover:text-neon-blue">
            {event.title}
          </h3>
          <div className="mt-1.5 flex items-center gap-1 text-xs text-slate-300">
            <Calendar className="h-3.5 w-3.5 text-neon-gold" />
            <span>{formatDate(event.startDatetime)}</span>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
