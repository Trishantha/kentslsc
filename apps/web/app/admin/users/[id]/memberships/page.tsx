'use client';

import { useParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { Loader2, CreditCard } from 'lucide-react';
import { api } from '@/lib/api';
import { cn, formatDate, formatCurrency } from '@/lib/utils';
import type { UserDetail } from '../../types';

export default function UserMembershipsPage() {
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
          <CreditCard className="h-5 w-5 text-neon-blue" /> Memberships
        </h3>
        {(detail.memberships ?? []).length === 0 ? (
          <p className="text-sm text-slate-500">No memberships found.</p>
        ) : (
          <div className="space-y-3">
            {(detail.memberships ?? []).map((m) => (
              <div key={m.id} className="rounded-xl border border-white/10 bg-white/5 p-4 text-sm">
                <div className="flex items-center justify-between">
                  <span className="font-semibold">{m.membershipType.name}</span>
                  <span
                    className={cn(
                      'rounded-full px-2 py-0.5 text-xs font-semibold',
                      m.status === 'ACTIVE'
                        ? 'bg-green-500/20 text-green-400'
                        : m.status === 'PENDING'
                          ? 'bg-yellow-500/20 text-yellow-400'
                          : 'bg-slate-500/20 text-slate-400'
                    )}
                  >
                    {m.status}
                  </span>
                </div>
                <p className="mt-1 text-slate-500">
                  {m.membershipType.isFree ? 'Free / Lifetime' : formatCurrency(m.membershipType.price)} ·{' '}
                  {formatDate(m.startDate)} – {formatDate(m.endDate)}
                </p>
                <p className="mt-1 font-mono text-xs text-slate-500">{m.membershipId}</p>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
