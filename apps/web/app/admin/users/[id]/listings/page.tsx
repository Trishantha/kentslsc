'use client';

import { useParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { Loader2, Store } from 'lucide-react';
import { api } from '@/lib/api';
import { formatDate } from '@/lib/utils';
import type { UserDetail } from '../../types';

export default function UserListingsPage() {
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
          <Store className="h-5 w-5 text-neon-blue" /> Business Listings
        </h3>
        {(detail.listings ?? []).length === 0 ? (
          <p className="text-sm text-slate-500">No business listings found.</p>
        ) : (
          <div className="space-y-3">
            {(detail.listings ?? []).map((l) => (
              <div key={l.id} className="rounded-xl border border-white/10 bg-white/5 p-4 text-sm">
                <div className="flex items-center justify-between">
                  <span className="font-semibold">{l.businessName}</span>
                  <span className="text-xs text-slate-500">{l.category || 'No category'}</span>
                </div>
                <p className="mt-1 text-slate-500">
                  {l.isPaid ? 'Paid' : 'Free'} · {l.isPromoted ? 'Featured' : 'Not featured'} ·{' '}
                  {formatDate(l.createdAt)}
                </p>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
