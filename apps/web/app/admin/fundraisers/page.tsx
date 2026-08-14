'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import {
  Plus,
  Loader2,
  HeartHandshake,
  Clock,
  TrendingUp,
  Users,
  Eye
} from 'lucide-react';
import Link from 'next/link';
import { api } from '@/lib/api';
import { AdminListLayout } from '@/components/admin/AdminListLayout';
import {
  type AdminFundraiser,
  type FundraisingStats,
  FUNDRAISER_STATUS_COLORS
} from './types';

export default function AdminFundraisersPage() {
  const [tab, setTab] = useState<'all' | 'pending'>('all');

  const { data: stats } = useQuery<FundraisingStats>({
    queryKey: ['admin', 'fundraisers', 'stats'],
    queryFn: async () => (await api.get('/admin/fundraisers/stats')).data
  });

  const { data, isLoading, error } = useQuery<{ items: AdminFundraiser[]; total: number } | AdminFundraiser[]>({
    queryKey: ['admin', 'fundraisers', tab],
    queryFn: async () => {
      if (tab === 'pending') {
        return (await api.get('/admin/fundraisers/pending')).data as AdminFundraiser[];
      }
      return (await api.get('/admin/fundraisers')).data as { items: AdminFundraiser[]; total: number };
    }
  });

  const items = Array.isArray(data) ? data : (data?.items ?? []);

  return (
    <AdminListLayout
      title="Fundraisers"
      description="Create and manage fundraising campaigns, offline donations and updates."
      action={
        <Link href="/admin/fundraisers/new" className="btn-primary inline-flex items-center gap-2">
          <Plus className="h-4 w-4" />
          New campaign
        </Link>
      }
    >
      {stats && (
        <div className="grid gap-4 sm:grid-cols-4">
          {[
            { label: 'Active Campaigns', value: stats.activeCampaigns, icon: <HeartHandshake className="h-5 w-5 text-neon-gold" /> },
            { label: 'Pending Review', value: stats.pendingCount, icon: <Clock className="h-5 w-5 text-amber-400" /> },
            { label: 'Total Raised', value: `£${stats.totalRaised.toLocaleString()}`, icon: <TrendingUp className="h-5 w-5 text-neon-blue" /> },
            { label: 'Total Donors', value: stats.totalDonors, icon: <Users className="h-5 w-5 text-slate-400" /> }
          ].map((s) => (
            <div key={s.label} className="glass-card flex items-center gap-3 p-4">
              {s.icon}
              <div>
                <p className="text-xl font-bold">{s.value}</p>
                <p className="text-xs text-slate-500 dark:text-slate-400">{s.label}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="glass-card mt-6 p-6">
        <div className="mb-4 flex gap-2">
          {(['all', 'pending'] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
                tab === t
                  ? 'bg-neon-blue text-white'
                  : 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300'
              }`}
            >
              {t === 'all' ? 'All Campaigns' : `Pending Review${stats?.pendingCount ? ` (${stats.pendingCount})` : ''}`}
            </button>
          ))}
        </div>

        {isLoading ? (
          <div className="flex h-40 items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-neon-blue" />
          </div>
        ) : error ? (
          <div className="flex h-40 items-center justify-center text-red-400">
            <p>Failed to load fundraisers. {(error as Error).message}</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-white/10 text-slate-500 dark:text-slate-400">
                  <th className="py-3 font-medium">Title</th>
                  <th className="py-3 font-medium">Target / Raised</th>
                  <th className="py-3 font-medium">Status</th>
                  <th className="py-3 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {items.map((f, idx) => (
                  <motion.tr
                    key={f.id}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: idx * 0.03 }}
                  >
                    <td className="py-3">
                      <div className="flex items-center gap-2">
                        <HeartHandshake className="h-4 w-4 shrink-0 text-neon-gold" />
                        <div>
                          <p className="font-medium">{f.title}</p>
                          {f.organizer && <p className="text-xs text-slate-400">by {f.organizer.name}</p>}
                        </div>
                      </div>
                    </td>
                    <td className="py-3">
                      <p>£{Number(f.targetAmount).toFixed(0)}</p>
                      <p className="text-xs text-neon-blue">£{Number(f.raisedAmount).toFixed(0)} raised</p>
                    </td>
                    <td className="py-3">
                      <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${FUNDRAISER_STATUS_COLORS[f.status] ?? FUNDRAISER_STATUS_COLORS.COMPLETED}`}>
                        {f.status.replace('_', ' ')}
                      </span>
                    </td>
                    <td className="py-3">
                      <div className="flex justify-end">
                        <Link
                          href={`/admin/fundraisers/${f.id}/overview`}
                          className="inline-flex items-center gap-1.5 rounded-lg bg-neon-blue/10 px-3 py-1.5 text-neon-blue hover:bg-neon-blue/20"
                        >
                          <Eye className="h-4 w-4" />
                          View
                        </Link>
                      </div>
                    </td>
                  </motion.tr>
                ))}
              </tbody>
            </table>
            {!items.length && (
              <div className="mt-8 text-center text-slate-500">
                No campaigns{tab === 'pending' ? ' pending approval' : ''}.
              </div>
            )}
          </div>
        )}
      </div>
    </AdminListLayout>
  );
}
