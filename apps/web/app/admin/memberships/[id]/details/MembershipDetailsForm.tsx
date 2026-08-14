'use client';

import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import {
  Loader2,
  Save,
  CheckCircle,
  XCircle,
  Users,
  Calendar,
  Mail,
  CreditCard,
  Hash
} from 'lucide-react';
import { api, getApiErrorMessage } from '@/lib/api';
import { formatDate, formatCurrency } from '@/lib/utils';
import type { AdminMembership } from '../../types';

const STATUSES = ['PENDING', 'ACTIVE', 'EXPIRED', 'CANCELLED'] as const;

interface MembershipDetailsFormProps {
  membership: AdminMembership;
}

export function MembershipDetailsForm({ membership }: MembershipDetailsFormProps) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [status, setStatus] = useState(membership.status);
  const [error, setError] = useState<string | null>(null);

  const statusMutation = useMutation({
    mutationFn: async (nextStatus: string) => {
      const res = await api.put(`/admin/memberships/${membership.id}/status`, { status: nextStatus });
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'memberships'] });
      router.refresh();
    },
    onError: (err) => setError(getApiErrorMessage(err))
  });

  const handleApprove = () => statusMutation.mutate('ACTIVE');
  const handleReject = () => statusMutation.mutate('CANCELLED');
  const handleSaveStatus = () => statusMutation.mutate(status);

  const isExpired = membership.endDate ? new Date(membership.endDate) < new Date() : false;

  return (
    <div className="max-w-3xl space-y-6">
      <section className="glass-card p-6">
        <h2 className="mb-4 text-lg font-semibold">Membership details</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="flex items-start gap-3">
            <Mail className="mt-0.5 h-4 w-4 text-slate-500" />
            <div>
              <p className="text-xs text-slate-500">Member</p>
              <p className="font-medium">{membership.user.name}</p>
              <p className="text-sm text-slate-500">{membership.user.email}</p>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <CreditCard className="mt-0.5 h-4 w-4 text-slate-500" />
            <div>
              <p className="text-xs text-slate-500">Membership type</p>
              <p className="font-medium">{membership.membershipType.name}</p>
              {typeof membership.membershipType.price === 'number' && (
                <p className="text-sm text-slate-500">
                  {membership.membershipType.isFree || membership.membershipType.price === 0
                    ? 'Free'
                    : formatCurrency(membership.membershipType.price)}
                  {' · '}
                  {membership.membershipType.durationMonths
                    ? `${membership.membershipType.durationMonths} months`
                    : 'Lifetime'}
                </p>
              )}
            </div>
          </div>

          <div className="flex items-start gap-3">
            <Calendar className="mt-0.5 h-4 w-4 text-slate-500" />
            <div>
              <p className="text-xs text-slate-500">Period</p>
              <p className="font-medium">
                {membership.startDate ? formatDate(membership.startDate) : 'Not started'}
                {' – '}
                {membership.endDate ? formatDate(membership.endDate) : 'No expiry'}
              </p>
              {isExpired && (
                <p className="text-xs text-amber-400">Expired</p>
              )}
            </div>
          </div>

          <div className="flex items-start gap-3">
            <Hash className="mt-0.5 h-4 w-4 text-slate-500" />
            <div>
              <p className="text-xs text-slate-500">Membership ID</p>
              <p className="font-mono text-sm">{membership.membershipId}</p>
            </div>
          </div>
        </div>
      </section>

      <section className="glass-card p-6">
        <h2 className="mb-4 text-lg font-semibold">Status</h2>

        <div className="flex flex-wrap items-center gap-3">
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value as typeof STATUSES[number])}
            disabled={statusMutation.isPending}
            className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-slate-900 outline-none focus:border-neon-blue disabled:opacity-50 dark:text-slate-100"
          >
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>

          <button
            type="button"
            onClick={handleSaveStatus}
            disabled={status === membership.status || statusMutation.isPending}
            className="btn-primary inline-flex items-center gap-2 disabled:opacity-50"
          >
            {statusMutation.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Save className="h-4 w-4" />
            )}
            Update status
          </button>
        </div>

        {membership.status === 'PENDING' && (
          <div className="mt-4 flex flex-wrap gap-3">
            <button
              type="button"
              onClick={handleApprove}
              disabled={statusMutation.isPending}
              className="inline-flex items-center gap-2 rounded-xl bg-green-500/10 px-4 py-2 text-sm font-semibold text-green-400 transition-colors hover:bg-green-500/20 disabled:opacity-50"
            >
              <CheckCircle className="h-4 w-4" />
              Approve
            </button>
            <button
              type="button"
              onClick={handleReject}
              disabled={statusMutation.isPending}
              className="inline-flex items-center gap-2 rounded-xl bg-red-500/10 px-4 py-2 text-sm font-semibold text-red-400 transition-colors hover:bg-red-500/20 disabled:opacity-50"
            >
              <XCircle className="h-4 w-4" />
              Reject
            </button>
          </div>
        )}

        {error && <p className="mt-3 text-sm text-red-400">{error}</p>}
      </section>

      <section className="glass-card p-6">
        <div className="mb-4 flex items-center gap-2">
          <Users className="h-5 w-5 text-slate-500" />
          <h2 className="text-lg font-semibold">Dependants</h2>
        </div>

        {membership.dependants?.length ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-white/10 text-slate-500 dark:text-slate-400">
                  <th className="py-2 font-medium">Name</th>
                  <th className="py-2 font-medium">Relationship</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {membership.dependants.map((dependant, idx) => (
                  <tr key={idx}>
                    <td className="py-2">{dependant.name}</td>
                    <td className="py-2 text-slate-500">{dependant.relationship}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-sm text-slate-500">No dependants on this membership.</p>
        )}
      </section>
    </div>
  );
}
