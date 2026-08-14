'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  Loader2,
  Trophy,
  Clock,
  WifiOff,
  Plus
} from 'lucide-react';
import { api } from '@/lib/api';
import type { FundraiserDonation } from '../../types';

const offlineDonationSchema = z.object({
  amount: z.coerce.number().min(0.01),
  displayName: z.string().optional(),
  message: z.string().optional()
});

type OfflineDonationForm = z.infer<typeof offlineDonationSchema>;

interface FundraiserDonationsProps {
  fundraiserId: string;
}

export function FundraiserDonations({ fundraiserId }: FundraiserDonationsProps) {
  const [sort, setSort] = useState<'recent' | 'top'>('recent');
  const [page, setPage] = useState(1);
  const queryClient = useQueryClient();

  const { register, handleSubmit, reset, formState: { errors } } = useForm<OfflineDonationForm>({
    resolver: zodResolver(offlineDonationSchema),
    defaultValues: { amount: 0 }
  });

  const { data, isLoading } = useQuery<{ items: FundraiserDonation[]; total: number; page: number; limit: number }>({
    queryKey: ['fundraiser', fundraiserId, 'donations', sort, page],
    queryFn: async () => {
      const res = await api.get(`/fundraisers/${fundraiserId}/donations`, {
        params: { sort, page, limit: 20 }
      });
      return res.data;
    }
  });

  const offlineMutation = useMutation({
    mutationFn: async (dto: OfflineDonationForm) => {
      const res = await api.post(`/admin/fundraisers/${fundraiserId}/offline-donation`, dto);
      return res.data;
    },
    onSuccess: () => {
      reset({ amount: 0 });
      queryClient.invalidateQueries({ queryKey: ['fundraiser', fundraiserId, 'donations'] });
      queryClient.invalidateQueries({ queryKey: ['admin', 'fundraisers'] });
      queryClient.invalidateQueries({ queryKey: ['admin', 'fundraiser', fundraiserId] });
    }
  });

  const timeAgo = (dateStr: string) => {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'just now';
    if (mins < 60) return `${mins}m ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    return `${Math.floor(hours / 24)}d ago`;
  };

  const donations = data?.items ?? [];
  const total = data?.total ?? 0;

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <div className="glass-card p-6 lg:col-span-1">
        <h2 className="mb-4 text-lg font-bold">Record offline donation</h2>
        <form
          onSubmit={handleSubmit((dto) => offlineMutation.mutate(dto))}
          className="space-y-4"
        >
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-600 dark:text-slate-400">Amount (£) *</label>
            <input
              type="number"
              step="0.01"
              min="0.01"
              {...register('amount')}
              className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm outline-none focus:border-neon-blue"
            />
            {errors.amount && <p className="mt-1 text-xs text-red-400">{errors.amount.message}</p>}
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-600 dark:text-slate-400">Donor name (optional)</label>
            <input
              {...register('displayName')}
              className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm outline-none focus:border-neon-blue"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-600 dark:text-slate-400">Message (optional)</label>
            <textarea
              {...register('message')}
              rows={2}
              className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm outline-none focus:border-neon-blue"
            />
          </div>
          <button
            type="submit"
            disabled={offlineMutation.isPending}
            className="btn-primary w-full"
          >
            {offlineMutation.isPending ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Plus className="mr-2 h-4 w-4" />
            )}
            Record donation
          </button>
        </form>
      </div>

      <div className="glass-card p-6 lg:col-span-2">
        <div className="mb-4 flex items-center justify-between gap-2">
          <h2 className="text-lg font-bold">Donations</h2>
          <div className="flex gap-2">
            {(['recent', 'top'] as const).map((t) => (
              <button
                key={t}
                onClick={() => { setSort(t); setPage(1); }}
                className={`flex items-center gap-1.5 rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
                  sort === t
                    ? 'bg-neon-blue text-white'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-700 dark:text-slate-300'
                }`}
              >
                {t === 'recent' ? <Clock className="h-3.5 w-3.5" /> : <Trophy className="h-3.5 w-3.5" />}
                {t === 'recent' ? 'Recent' : 'Top donors'}
              </button>
            ))}
          </div>
        </div>

        {isLoading ? (
          <div className="flex h-40 items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-neon-blue" />
          </div>
        ) : donations.length === 0 ? (
          <div className="py-8 text-center text-slate-500">No donations yet.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-white/10 text-slate-500 dark:text-slate-400">
                  <th className="py-2 font-medium">Donor</th>
                  <th className="py-2 font-medium">Amount</th>
                  <th className="py-2 font-medium">Message</th>
                  <th className="py-2 font-medium text-right">When</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {donations.map((d) => (
                  <tr key={d.id}>
                    <td className="py-2">{d.displayName}</td>
                    <td className="py-2">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-neon-blue">£{Number(d.amount).toFixed(2)}</span>
                        {d.isOffline && (
                          <span className="flex items-center gap-0.5 rounded-full bg-amber-100 px-2 py-0.5 text-xs text-amber-700 dark:bg-amber-900/30 dark:text-amber-300">
                            <WifiOff className="h-3 w-3" /> offline
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="py-2 text-slate-500">{d.message || '-'}</td>
                    <td className="py-2 text-right text-slate-500">{timeAgo(d.donatedAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            {donations.length < total && (
              <button
                onClick={() => setPage((p) => p + 1)}
                className="mt-4 w-full rounded-xl border border-slate-200 py-2 text-sm text-slate-600 transition-colors hover:bg-slate-50 dark:border-slate-700 dark:text-slate-400 dark:hover:bg-slate-800"
              >
                Show more ({total - donations.length} remaining)
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
