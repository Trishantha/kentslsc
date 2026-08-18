'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Loader2, Users, Mail } from 'lucide-react';
import { api, getApiErrorMessage } from '@/lib/api';
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

interface ReminderResult {
  sent: number;
  failed: number;
  total: number;
}

export default function AdminMembershipsPage() {
  const [status, setStatus] = useState('PENDING');
  const [reminderResult, setReminderResult] = useState<ReminderResult | null>(null);
  const [reminderError, setReminderError] = useState<string | null>(null);
  const queryClient = useQueryClient();

  const { data, isLoading, error } = useQuery<{ items: AdminMembership[]; total: number }>({
    queryKey: ['admin', 'memberships', status],
    queryFn: async () => {
      const params = new URLSearchParams({ page: '1', limit: '100' });
      if (status !== 'ALL') params.append('status', status);
      const res = await api.get(`/admin/memberships?${params.toString()}`);
      return res.data;
    }
  });

  const reminderMutation = useMutation<ReminderResult, unknown, void>({
    mutationFn: async () => {
      const res = await api.post('/admin/memberships/send-payment-reminders');
      return res.data;
    },
    onSuccess: (result) => {
      setReminderResult(result);
      setReminderError(null);
      queryClient.invalidateQueries({ queryKey: ['admin', 'memberships'] });
    },
    onError: (err) => {
      setReminderResult(null);
      setReminderError(getApiErrorMessage(err));
    }
  });

  const handleSendReminders = () => {
    if (
      !window.confirm(
        'This will send a payment reminder email to every pending paid membership. Do you want to continue?'
      )
    ) {
      return;
    }
    reminderMutation.mutate();
  };

  return (
    <AdminListLayout
      title="Memberships"
      description="Review and manage member applications, status, and membership cards."
    >
      <div className="glass-card p-6">
        <div className="mb-4 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
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

          <button
            type="button"
            onClick={handleSendReminders}
            disabled={reminderMutation.isPending}
            className="inline-flex items-center gap-2 rounded-xl bg-neon-blue/10 px-4 py-2 text-sm font-semibold text-neon-blue transition-colors hover:bg-neon-blue/20 disabled:opacity-50"
          >
            {reminderMutation.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Mail className="h-4 w-4" />
            )}
            Send reminders to all pending
          </button>
        </div>

        {reminderResult && (
          <div className="mb-4 rounded-xl border border-green-500/20 bg-green-500/10 p-3 text-sm text-green-400">
            Reminders sent: {reminderResult.sent} succeeded, {reminderResult.failed} failed (out of{' '}
            {reminderResult.total}).
          </div>
        )}

        {reminderError && (
          <div className="mb-4 rounded-xl border border-red-500/20 bg-red-500/10 p-3 text-sm text-red-400">
            {reminderError}
          </div>
        )}

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
