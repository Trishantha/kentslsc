'use client';

import { useParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { Loader2, Heart } from 'lucide-react';
import { api } from '@/lib/api';
import { formatDate, formatCurrency } from '@/lib/utils';
import type { UserDetail } from '../../types';

export default function UserDonationsPage() {
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
          <Heart className="h-5 w-5 text-neon-blue" /> Donations
        </h3>
        {(detail.donations ?? []).length === 0 ? (
          <p className="text-sm text-slate-500">No donations found.</p>
        ) : (
          <div className="space-y-3">
            {(detail.donations ?? []).map((d) => (
              <div key={d.id} className="rounded-xl border border-white/10 bg-white/5 p-4 text-sm">
                <div className="flex items-center justify-between">
                  <span className="font-semibold">{d.fundraiser.title}</span>
                  <span className="font-semibold text-neon-gold">{formatCurrency(d.amount)}</span>
                </div>
                <p className="mt-1 text-slate-500">{formatDate(d.donatedAt)}</p>
                {d.message && <p className="mt-1 text-slate-400">{d.message}</p>}
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
