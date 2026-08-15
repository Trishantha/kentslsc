'use client';

import { useState } from 'react';
import { useParams } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Loader2, CreditCard, Plus, X } from 'lucide-react';
import { api, getApiErrorMessage } from '@/lib/api';
import { cn, formatDate, formatCurrency } from '@/lib/utils';
import { MembershipStatus } from '@kentslsc/shared';
import type { UserDetail } from '../../types';
import type { AdminMembershipType } from '../../../membership-types/types';

export default function UserMembershipsPage() {
  const { id } = useParams<{ id: string }>();
  const queryClient = useQueryClient();
  const [isOpen, setIsOpen] = useState(false);
  const [selectedTypeId, setSelectedTypeId] = useState('');
  const [status, setStatus] = useState<MembershipStatus>(MembershipStatus.ACTIVE);
  const [error, setError] = useState<string | null>(null);

  const { data: detail, isLoading } = useQuery<UserDetail>({
    queryKey: ['admin', 'users', id],
    queryFn: async () => {
      const res = await api.get(`/admin/users/${id}`);
      return res.data;
    },
    enabled: !!id
  });

  const { data: types, isLoading: typesLoading } = useQuery<AdminMembershipType[]>({
    queryKey: ['admin', 'membership-types'],
    queryFn: async () => {
      const res = await api.get('/membership/types');
      return res.data;
    }
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      const res = await api.post(`/admin/users/${id}/memberships`, {
        membershipTypeId: selectedTypeId,
        status
      });
      return res.data;
    },
    onSuccess: () => {
      setError(null);
      setIsOpen(false);
      setSelectedTypeId('');
      queryClient.invalidateQueries({ queryKey: ['admin', 'users', id] });
    },
    onError: (err) => setError(getApiErrorMessage(err))
  });

  const statusMutation = useMutation({
    mutationFn: async ({ membershipId, nextStatus }: { membershipId: string; nextStatus: MembershipStatus }) => {
      const res = await api.put(`/admin/memberships/${membershipId}/status`, { status: nextStatus });
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'users', id] });
    }
  });

  if (isLoading || !detail) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-neon-blue" />
      </div>
    );
  }

  const availableTypes = (types ?? []).filter((t) => t.hasCapacity !== false);

  return (
    <div className="max-w-3xl space-y-6">
      <section className="glass-card p-5">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="flex items-center gap-2 text-lg font-semibold">
            <CreditCard className="h-5 w-5 text-neon-blue" /> Memberships
          </h3>
          <button
            type="button"
            onClick={() => setIsOpen(true)}
            className="inline-flex items-center gap-1.5 rounded-lg bg-neon-blue px-3 py-1.5 text-xs font-semibold text-white hover:bg-neon-blue/90"
          >
            <Plus className="h-4 w-4" /> Add / Upgrade
          </button>
        </div>

        {(detail.memberships ?? []).length === 0 ? (
          <p className="text-sm text-slate-500">No memberships found.</p>
        ) : (
          <div className="space-y-3">
            {(detail.memberships ?? []).map((m) => (
              <div key={m.id} className="rounded-xl border border-white/10 bg-white/5 p-4 text-sm">
                <div className="flex items-center justify-between">
                  <span className="font-semibold">{m.membershipType.name}</span>
                  <div className="flex items-center gap-2">
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
                    <select
                      value={m.status}
                      onChange={(e) =>
                        statusMutation.mutate({
                          membershipId: m.id,
                          nextStatus: e.target.value as MembershipStatus
                        })
                      }
                      disabled={statusMutation.isPending}
                      className="rounded-lg border border-white/10 bg-white/5 px-2 py-1 text-xs text-slate-100 outline-none focus:border-neon-blue disabled:opacity-60"
                    >
                      {Object.values(MembershipStatus).map((s) => (
                        <option key={s} value={s}>
                          {s}
                        </option>
                      ))}
                    </select>
                  </div>
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

      {isOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
          onClick={() => setIsOpen(false)}
        >
          <div
            className="w-full max-w-md rounded-2xl border border-white/10 bg-slate-950 p-6 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-bold">Add or Upgrade Membership</h3>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="rounded-lg p-2 text-slate-400 hover:bg-white/5 hover:text-slate-200"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="mb-2 block text-sm font-medium text-slate-300">Membership Type</label>
                {typesLoading ? (
                  <div className="flex h-10 items-center gap-2 text-sm text-slate-500">
                    <Loader2 className="h-4 w-4 animate-spin" /> Loading types...
                  </div>
                ) : (
                  <select
                    value={selectedTypeId}
                    onChange={(e) => setSelectedTypeId(e.target.value)}
                    className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-slate-100 outline-none focus:border-neon-blue"
                  >
                    <option value="">Select a type</option>
                    {availableTypes.map((type) => (
                      <option key={type.id} value={type.id}>
                        {type.name} — {type.isFree || type.price === 0 ? 'Free' : `£${type.price}`}
                      </option>
                    ))}
                  </select>
                )}
                {availableTypes.length === 0 && !typesLoading && (
                  <p className="mt-1 text-xs text-red-400">No available membership types.</p>
                )}
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-slate-300">Initial Status</label>
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value as MembershipStatus)}
                  className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-slate-100 outline-none focus:border-neon-blue"
                >
                  {Object.values(MembershipStatus).map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </div>

              {error && (
                <div className="rounded-xl bg-red-500/10 p-3 text-sm text-red-400">
                  {error}
                </div>
              )}

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  className="rounded-xl px-5 py-2.5 text-sm font-medium text-slate-400 hover:bg-white/5"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => createMutation.mutate()}
                  disabled={!selectedTypeId || createMutation.isPending}
                  className="inline-flex items-center gap-2 rounded-xl bg-neon-blue px-5 py-2.5 text-sm font-semibold text-white transition-transform hover:scale-[1.02] disabled:opacity-60"
                >
                  {createMutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                  <CreditCard className="h-4 w-4" />
                  Create Membership
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
