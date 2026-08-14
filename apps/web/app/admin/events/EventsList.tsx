'use client';

import Link from 'next/link';
import { motion } from 'framer-motion';
import { Eye, Ticket, QrCode } from 'lucide-react';
import { cn } from '@/lib/utils';
import { eventCategoryLabels } from '@kentslsc/shared';
import type { AdminEvent } from './page';

interface EventsListProps {
  events: AdminEvent[];
}

export function EventsList({ events }: EventsListProps) {
  return (
    <div className="glass-card overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-white/10 text-slate-500 dark:text-slate-400">
              <th className="px-4 py-3 font-medium">Title</th>
              <th className="px-4 py-3 font-medium">Category</th>
              <th className="px-4 py-3 font-medium">Location</th>
              <th className="px-4 py-3 font-medium">Start</th>
              <th className="px-4 py-3 font-medium">Price</th>
              <th className="px-4 py-3 font-medium">Tickets</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {events.map((event, idx) => {
              const sold = event.soldCount ?? event._count?.tickets ?? 0;
              const remaining = event.remainingCount ??
                (event.maxTickets != null ? event.maxTickets - sold : null);
              const hasEnded = new Date(event.endDatetime) < new Date();

              return (
                <motion.tr
                  key={event.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: idx * 0.03 }}
                  className="group"
                >
                  <td className="px-4 py-3 font-medium">
                    <Link
                      href={`/admin/events/${event.id}/basic`}
                      className="hover:text-neon-blue"
                    >
                      {event.title}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-slate-600 dark:text-slate-400">
                    {eventCategoryLabels[event.category]}
                  </td>
                  <td className="px-4 py-3 text-slate-600 dark:text-slate-400">
                    {event.location || '-'}
                  </td>
                  <td className="px-4 py-3 text-slate-600 dark:text-slate-400">
                    {new Date(event.startDatetime).toLocaleString('en-GB')}
                  </td>
                  <td className="px-4 py-3">
                    {event.isFree || Number(event.ticketPrice) === 0
                      ? 'Free'
                      : `£${Number(event.ticketPrice).toFixed(2)}`}
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-slate-600 dark:text-slate-400">
                      {sold}
                      {remaining !== null && ` / ${event.maxTickets}`} sold
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1.5">
                      <span
                        className={cn(
                          'rounded-full px-2 py-0.5 text-xs font-semibold',
                          event.isPublished
                            ? 'bg-green-500/10 text-green-400'
                            : 'bg-slate-500/10 text-slate-400'
                        )}
                      >
                        {event.isPublished ? 'Published' : 'Draft'}
                      </span>
                      {hasEnded && (
                        <span className="rounded-full bg-amber-500/10 px-2 py-0.5 text-xs font-semibold text-amber-400">
                          Ended
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-2">
                      <Link
                        href={`/admin/events/${event.id}/basic`}
                        className="rounded-lg bg-neon-blue/10 p-2 text-neon-blue hover:bg-neon-blue/20"
                        title="View details"
                      >
                        <Eye className="h-4 w-4" />
                      </Link>
                      <Link
                        href={`/admin/events/${event.id}/tickets`}
                        className="rounded-lg bg-white/5 p-2 text-slate-300 hover:bg-white/10 hover:text-white"
                        title="Tickets"
                      >
                        <Ticket className="h-4 w-4" />
                      </Link>
                      <Link
                        href={`/admin/events/${event.id}/scanner`}
                        className="rounded-lg bg-white/5 p-2 text-slate-300 hover:bg-white/10 hover:text-white"
                        title="Scanner"
                      >
                        <QrCode className="h-4 w-4" />
                      </Link>
                    </div>
                  </td>
                </motion.tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
