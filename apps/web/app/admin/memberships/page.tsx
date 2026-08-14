'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Loader2, Users } from 'lucide-react';
import { api } from '@/lib/api';
import { AdminListLayout } from '@/components/admin/AdminListLayout';
import { MembershipsList } from './MembershipsList';
import type { AdminMembership } from './types';

const STATUS_OPTIONS = [
  { value: 'ALL', label: 'All statuses' },
  { value: 'PENDING', label: 'Pending' },
  { value: 'ACTIVE', label: 'Active' },
  { value: 'EXPIRED', label: 'Expired' },
  { value: 'CANCELLED', label: 'Cancelled' }
];

export default function AdminMembershipsPage() {
  const [status, setStatus] = useState('PENDING');

  const { data, isLoading, error } = useQuery<{ items: AdminMembership[]; total: number }>({
    queryKey: ['admin', 'memberships', status],
    queryFn: async () => {
      const params = new URLSearchParams({ page: '1', limit: '100' });
      if (status !== 'ALL') params.append('status', status);
      const res = await api.get(`/admin/memberships?${params.toString()}`);
      return res.data;
    }
  });

  return (
    <AdminListLayout
      title="Memberships"
      description="Review and manage member applications, status, and membership cards."
    >
      <div className="glass-card p-6">
        <div className="mb-4">
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-slate-900 outline-none focus:border-neon-blue dark:text-slate-100"
          >
            {STATUS_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>

        {isLoading ? (
          <div className="flex h-64 items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-neon-blue" />
          </div>
        ) : error ? (
          <div className="flex h-64 flex-col items-center justify-center gap-3 text-center text-red-400">
            <p>Failed to load memberships.</p>
            <p className="text-sm text-slate-500">{(error as Error).message}</p>
          </div>
        ) : data?.items?.length ? (
          <MembershipsList memberships={data.items} />
        ) : (
          <div className="flex h-64 flex-col items-center justify-center gap-4 text-center">
            <Users className="h-10 w-10 text-slate-500" />
            <div>
              <p className="font-medium">No memberships found</p>
              <p className="text-sm text-slate-500">Try a different status filter.</p>
            </div>
          </div>
        )}
      </div>
    </AdminListLayout>
  );
}
