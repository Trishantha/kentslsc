'use client';

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { Loader2, Ticket, ArrowRight } from 'lucide-react';
import { api } from '@/lib/api';
import { TicketListItem } from '@/components/ui/TicketListItem';
import type { TicketListItemProps } from '@/components/ui/TicketListItem';

export function TicketsPreview() {
  const { data: tickets, isLoading } = useQuery<TicketListItemProps['ticket'][]>({
    queryKey: ['tickets', 'mine'],
    queryFn: async () => {
      const { data } = await api.get<TicketListItemProps['ticket'][]>('/tickets');
      return data;
    }
  });

  const upcomingTickets =
    tickets?.filter((ticket) => ticket.status === 'VALID' && new Date(ticket.event.endDatetime) > new Date()) ??
    [];

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.35 }}
    >
      <div className="flex items-center justify-between gap-4">
        <h2 className="section-title text-2xl">My Tickets</h2>
        <Link
          href="/dashboard/tickets"
          className="inline-flex items-center text-sm font-medium text-neon-blue hover:underline"
        >
          View all tickets <ArrowRight className="ml-1 h-4 w-4" />
        </Link>
      </div>
      <p className="mt-2 text-slate-700 dark:text-slate-400">Your upcoming event tickets.</p>

      {isLoading && (
        <div className="mt-6 flex items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-neon-blue" />
        </div>
      )}

      <div className="mt-6 space-y-4">
        {upcomingTickets.slice(0, 3).map((ticket) => (
          <TicketListItem key={ticket.id} ticket={ticket} />
        ))}
      </div>

      {!isLoading && upcomingTickets.length === 0 && (
        <div className="mt-6 rounded-2xl bg-white/5 p-8 text-center">
          <p className="text-slate-600 dark:text-slate-400">You do not have any upcoming tickets.</p>
          <Link href="/events" className="btn-primary mt-4 inline-block">
            Browse events
          </Link>
        </div>
      )}
    </motion.div>
  );
}
