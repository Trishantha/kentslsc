'use client';

import { useParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { Loader2, Ticket } from 'lucide-react';
import { api } from '@/lib/api';
import { formatDate } from '@/lib/utils';
import type { UserDetail } from '../../types';

export default function UserTicketsPage() {
  const { id } = useParams<{ id: string }>();

  const { data: detail, isLoading } = useQuery<UserDetail>({
    queryKey: ['admin', 'users', id],
    queryFn: async () => {
      const res = await api.get(`/admin/users/${id}`);
      return res.data;
    },
    enabled: !!id
  });

  if (isLoading || !detail) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-neon-blue" />
      </div>
    );
  }

  return (
    <div className="max-w-3xl">
      <section className="glass-card p-5">
        <h3 className="mb-4 flex items-center gap-2 text-lg font-semibold">
          <Ticket className="h-5 w-5 text-neon-blue" /> Tickets
        </h3>
        {(detail.tickets ?? []).length === 0 ? (
          <p className="text-sm text-slate-500">No tickets found.</p>
        ) : (
          <div className="space-y-3">
            {(detail.tickets ?? []).map((t) => (
              <div key={t.id} className="rounded-xl border border-white/10 bg-white/5 p-4 text-sm">
                <div className="font-semibold">{t.event.title}</div>
                <p className="mt-1 text-slate-500">
                  {formatDate(t.event.startDatetime)} · Status: {t.status}
                </p>
                {t.stripeSessionId && (
                  <p className="mt-1 font-mono text-xs text-slate-500">Session: {t.stripeSessionId}</p>
                )}
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
