'use client';

import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Calendar, MapPin, Loader2, Minus, Plus, Ticket, ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { api } from '@/lib/api';
import { formatDate, formatCurrency, cn } from '@/lib/utils';
import { useAuth } from '@/hooks/useAuth';

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
  tickets?: { id: string }[];
  _count?: { tickets: number };
}

export default function EventDetailPage() {
  const params = useParams();
  const router = useRouter();
  const eventId = params.id as string;
  const { data: user, isLoading: authLoading } = useAuth();
  const [quantity, setQuantity] = useState(1);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const { data: event, isLoading } = useQuery<Event>({
    queryKey: ['events', eventId],
    queryFn: async () => {
      const { data } = await api.get<Event>(`/events/${eventId}`);
      return data;
    },
    enabled: !!eventId
  });

  const purchase = useMutation({
    mutationFn: async () => {
      const { data } = await api.post<{ free: boolean; tickets?: { id: string }[]; url?: string }>(
        `/events/${eventId}/tickets/purchase`,
        { eventId, quantity }
      );
      return data;
    },
    onSuccess: (data) => {
      if (data.free) {
        setMessage({ type: 'success', text: 'Tickets reserved! Redirecting to your tickets...' });
        setTimeout(() => router.push('/dashboard/tickets'), 1500);
      } else if (data.url) {
        window.location.href = data.url;
      }
    },
    onError: (err: { response?: { data?: { message?: string } }; message?: string }) => {
      const text = err.response?.data?.message || err.message || 'Purchase failed';
      setMessage({ type: 'error', text });
    }
  });

  const handleBuy = () => {
    if (!user) {
      router.push(`/auth/login?returnTo=/events/${eventId}`);
      return;
    }
    purchase.mutate();
  };

  const remaining =
    event && typeof event.maxTickets === 'number' && typeof event._count?.tickets === 'number'
      ? event.maxTickets - event._count.tickets
      : null;

  if (isLoading || authLoading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-neon-blue" />
      </div>
    );
  }

  if (!event) {
    return (
      <div className="px-4 py-16 text-center md:px-6">
        <h1 className="text-2xl font-bold">Event not found</h1>
        <Link href="/events" className="btn-primary mt-6 inline-block">
          Back to Events
        </Link>
      </div>
    );
  }

  const hasCapacity = remaining === null || remaining > 0;
  const canSelectQuantity = hasCapacity && quantity <= (remaining ?? 10);
  const isFree = Number(event.ticketPrice) === 0;
  const total = Number(event.ticketPrice) * quantity;

  return (
    <div className="px-4 py-12 md:px-6">
      <div className="mx-auto max-w-4xl">
        <Link href="/events" className="inline-flex items-center gap-2 text-sm text-slate-600 hover:text-neon-blue dark:text-slate-400">
          <ArrowLeft className="h-4 w-4" /> Back to events
        </Link>

        <div className="mt-6 glass-card overflow-hidden">
          <div
            className={cn(
              'h-64 w-full bg-gradient-to-br from-neon-blue/30 to-neon-gold/30',
              event.imageUrl && 'bg-cover bg-center'
            )}
            style={event.imageUrl ? { backgroundImage: `url(${event.imageUrl})` } : undefined}
          />
          <div className="p-6 md:p-10">
            <h1 className="text-3xl font-bold md:text-4xl">{event.title}</h1>

            <div className="mt-4 flex flex-wrap gap-4 text-sm text-slate-600 dark:text-slate-400">
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
            </div>

            {event.description && (
              <p className="mt-6 whitespace-pre-line text-slate-700 dark:text-slate-300">
                {event.description}
              </p>
            )}

            <div className="mt-8 flex flex-col gap-6 rounded-2xl bg-white/5 p-6 dark:bg-black/20">
              <div className="flex items-center justify-between">
                <span className="text-lg font-semibold">
                  {isFree ? 'Free ticket' : formatCurrency(Number(event.ticketPrice))} each
                </span>
                {remaining !== null && (
                  <span className={cn('text-sm', remaining <= 5 ? 'text-red-500' : 'text-slate-500')}>
                    {remaining} left
                  </span>
                )}
              </div>

              <div className="flex items-center gap-4">
                <span className="text-sm font-medium">Quantity</span>
                <div className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/5 p-1 dark:bg-black/20">
                  <button
                    type="button"
                    disabled={quantity <= 1}
                    onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                    className="rounded-lg p-2 hover:bg-white/10 disabled:opacity-40"
                  >
                    <Minus className="h-4 w-4" />
                  </button>
                  <span className="w-8 text-center font-semibold">{quantity}</span>
                  <button
                    type="button"
                    disabled={!hasCapacity || quantity >= (remaining ?? 10) || quantity >= 10}
                    onClick={() => setQuantity((q) => Math.min(10, q + 1))}
                    className="rounded-lg p-2 hover:bg-white/10 disabled:opacity-40"
                  >
                    <Plus className="h-4 w-4" />
                  </button>
                </div>
              </div>

              {message && (
                <div
                  className={cn(
                    'rounded-xl p-3 text-sm',
                    message.type === 'success'
                      ? 'bg-green-500/10 text-green-600 dark:text-green-400'
                      : 'bg-red-500/10 text-red-600 dark:text-red-400'
                  )}
                >
                  {message.text}
                </div>
              )}

              <button
                onClick={handleBuy}
                disabled={purchase.isPending || !hasCapacity || !canSelectQuantity}
                className="btn-primary w-full"
              >
                {purchase.isPending ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Ticket className="mr-2 h-4 w-4" />
                )}
                {user ? (isFree ? 'Reserve tickets' : `Buy for ${formatCurrency(total)}`) : 'Log in to buy tickets'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
