'use client';

import { useQuery } from '@tanstack/react-query';
import { Loader2, Ticket } from 'lucide-react';
import { api } from '@/lib/api';
import { TicketCard } from '@/components/ui/TicketCard';
import type { TicketCardProps } from '@/components/ui/TicketCard';

export default function TicketsPage() {
  const { data: tickets, isLoading } = useQuery<TicketCardProps['ticket'][]>({
    queryKey: ['tickets', 'mine'],
    queryFn: async () => {
      const { data } = await api.get<TicketCardProps['ticket'][]>('/tickets');
      return data;
    }
  });

  return (
    <div className="px-4 py-12 md:px-6">
      <div className="mx-auto max-w-4xl">
        <div className="flex items-center gap-3">
          <Ticket className="h-7 w-7 text-neon-blue" />
          <h1 className="section-title">My Tickets</h1>
        </div>
        <p className="mt-2 text-slate-600 dark:text-slate-400">
          View and manage your event tickets.
        </p>

        {isLoading && (
          <div className="mt-10 flex items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-neon-blue" />
          </div>
        )}

        <div className="mt-10 space-y-6">
          {tickets?.map((ticket) => (
            <TicketCard key={ticket.id} ticket={ticket} />
          ))}
        </div>

        {!isLoading && tickets?.length === 0 && (
          <div className="mt-10 rounded-2xl bg-white/5 p-10 text-center dark:bg-black/20">
            <p className="text-slate-600 dark:text-slate-400">You do not have any tickets yet.</p>
            <a href="/events" className="btn-primary mt-4 inline-block">
              Browse events
            </a>
          </div>
        )}
      </div>
    </div>
  );
}
