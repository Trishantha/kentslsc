'use client';

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Loader2, Ticket, CheckCircle, AlertCircle } from 'lucide-react';
import Link from 'next/link';
import { api } from '@/lib/api';
import { TicketCard } from '@/components/ui/TicketCard';
import type { TicketCardProps } from '@/components/ui/TicketCard';

type ConfirmStatus =
  | { state: 'idle' }
  | { state: 'confirming' }
  | { state: 'success'; message: string }
  | { state: 'error'; message: string };

export default function TicketsPage() {
  const searchParams = useSearchParams();
  const sessionId = searchParams.get('session_id');
  const provider = (searchParams.get('provider') as 'stripe' | 'paypal') ?? 'stripe';
  const [confirmStatus, setConfirmStatus] = useState<ConfirmStatus>({ state: 'idle' });

  const {
    data: tickets,
    isLoading,
    refetch
  } = useQuery<TicketCardProps['ticket'][]>({
    queryKey: ['tickets', 'mine'],
    queryFn: async () => {
      const { data } = await api.get<TicketCardProps['ticket'][]>('/tickets');
      return data;
    }
  });

  const confirmMutation = useMutation({
    mutationFn: async (input: { sessionId: string; provider: 'stripe' | 'paypal' }) => {
      const { data } = await api.post('/tickets/confirm-payment', input);
      return data as { tickets: TicketCardProps['ticket'][]; created: boolean };
    },
    onSuccess: (result) => {
      setConfirmStatus({
        state: 'success',
        message: result.created
          ? `Your payment was confirmed and ${result.tickets.length} ticket(s) have been issued.`
          : 'Your tickets are ready.'
      });
      void refetch();
    },
    onError: (err) => {
      const message =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ??
        'We could not confirm your payment. Please contact support if you have been charged.';
      setConfirmStatus({ state: 'error', message });
    }
  });

  useEffect(() => {
    if (sessionId && confirmStatus.state === 'idle') {
      setConfirmStatus({ state: 'confirming' });
      confirmMutation.mutate({ sessionId, provider });
    }
  }, [sessionId, provider, confirmMutation, confirmStatus.state]);

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

        {confirmStatus.state === 'confirming' && (
          <div className="mt-6 flex items-center gap-2 rounded-xl border border-neon-blue/20 bg-neon-blue/10 p-4 text-sm text-neon-blue">
            <Loader2 className="h-4 w-4 animate-spin" />
            Confirming your payment and issuing your tickets…
          </div>
        )}

        {confirmStatus.state === 'success' && (
          <div className="mt-6 flex items-start gap-2 rounded-xl border border-green-500/20 bg-green-500/10 p-4 text-sm text-green-600 dark:text-green-400">
            <CheckCircle className="h-4 w-4 shrink-0" />
            {confirmStatus.message}
          </div>
        )}

        {confirmStatus.state === 'error' && (
          <div className="mt-6 flex items-start gap-2 rounded-xl border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-600 dark:text-red-400">
            <AlertCircle className="h-4 w-4 shrink-0" />
            {confirmStatus.message}
          </div>
        )}

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
            <Link href="/events" className="btn-primary mt-4 inline-block">
              Browse events
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
