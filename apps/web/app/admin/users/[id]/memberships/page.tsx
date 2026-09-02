'use client';

import { useState } from 'react';
import { useParams } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Loader2, CreditCard, Plus, X, Copy, Check, Mail, Banknote, Trash2 } from 'lucide-react';
import { api, getApiErrorMessage } from '@/lib/api';
import { cn, formatDate, formatCurrency } from '@/lib/utils';
import { MembershipStatus, MembershipFeature } from '@kentslsc/shared';
import type { UserDetail } from '../../types';
import type { AdminMembershipType } from '../../../membership-types/types';

interface AdminMembership {
  id: string;
  membershipId: string;
  status: MembershipStatus;
  startDate: string;
  endDate: string;
  paidAt: string | null;
  paymentMethod: string | null;
  membershipType: AdminMembershipType;
}

export default function UserMembershipsPage() {
  const { id } = useParams<{ id: string }>();
  const queryClient = useQueryClient();
  const [isOpen, setIsOpen] = useState(false);
  const [selectedTypeId, setSelectedTypeId] = useState('');
  const [status, setStatus] = useState<MembershipStatus>(MembershipStatus.ACTIVE);
  const [paymentMode, setPaymentMode] = useState<'online' | 'offline'>('online');
  const [paymentLink, setPaymentLink] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dependants, setDependants] = useState<{ name: string; age: number; relationship: 'spouse' | 'child' }[]>([]);

  const { data: detail, isLoading } = useQuery<UserDetail>({
    queryKey: ['admin', 'users', id],
    queryFn: async () => {
      const res = await api.get(`/admin/users/${id}`);
      return res.data;
    },
    enabled: !!id,
    // Payment status is updated out-of-band by the Stripe webhook, so always
    // show admins the current state rather than a cached "Unpaid".
    staleTime: 0,
    refetchOnWindowFocus: true
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
      const payload: {
        membershipTypeId: string;
        status: MembershipStatus;
        paymentMode?: 'online' | 'offline';
        dependants?: { name: string; age: number; relationship: 'spouse' | 'child' }[];
      } = {
        membershipTypeId: selectedTypeId,
        status
      };
      const selectedType = types?.find((t) => t.id === selectedTypeId);
      if (selectedType && !selectedType.isFree && selectedType.price > 0) {
        payload.paymentMode = paymentMode;
      }
      payload.dependants = dependants;
      const res = await api.post(`/admin/users/${id}/memberships`, payload);
      return res.data as {
        membership: AdminMembership;
        paid: boolean;
        paymentMethod?: string;
        url?: string;
        provider?: string;
      };
    },
    onSuccess: (data) => {
      setError(null);
      setPaymentLink(data.url ?? null);
      if (!data.url) {
        setIsOpen(false);
        setSelectedTypeId('');
      }
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

  const sendLinkMutation = useMutation({
    mutationFn: async (membershipId: string) => {
      const res = await api.post(`/admin/memberships/${membershipId}/send-payment-link`);
      return res.data as { url: string; provider: string };
    },
    onSuccess: (data) => {
      setPaymentLink(data.url);
      setCopied(false);
    },
    onError: (err) => setError(getApiErrorMessage(err))
  });

  const handleCopy = async () => {
    if (!paymentLink) return;
    try {
      await navigator.clipboard.writeText(paymentLink);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  };

  const handleClose = () => {
    setIsOpen(false);
    setSelectedTypeId('');
    setPaymentLink(null);
    setCopied(false);
    setError(null);
    setDependants([]);
  };

  if (isLoading || !detail) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-neon-blue" />
      </div>
    );
  }

  const availableTypes = (types ?? []).filter((t) => t.hasCapacity !== false);
  const selectedType = types?.find((t) => t.id === selectedTypeId);
  const isPaidSelected = selectedType && !selectedType.isFree && selectedType.price > 0;

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
                {!m.membershipType.isFree && m.membershipType.price > 0 && (
                  <div className="mt-2 flex items-center gap-3 text-xs text-slate-400">
                    <span className="flex items-center gap-1">
                      {m.paymentMethod ? (
                        <>
                          <Banknote className="h-3 w-3 text-green-400" />
                          Paid {m.paymentMethod}
                        </>
                      ) : (
                        <>
                          <CreditCard className="h-3 w-3 text-yellow-400" />
                          Unpaid
                        </>
                      )}
                    </span>
                    {m.paidAt && <span>· {formatDate(m.paidAt)}</span>}
                    {m.status === 'PENDING' && !m.paymentMethod && (
                      <button
                        type="button"
                        onClick={() => sendLinkMutation.mutate(m.id)}
                        disabled={sendLinkMutation.isPending}
                        className="inline-flex items-center gap-1 text-neon-blue hover:underline disabled:opacity-60"
                      >
                        <Mail className="h-3 w-3" />
                        {sendLinkMutation.isPending ? 'Sending…' : 'Send payment link'}
                      </button>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </section>

      {isOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
          onClick={handleClose}
        >
          <div
            className="w-full max-w-md rounded-2xl border border-white/10 bg-slate-950 p-6 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-bold">Add or Upgrade Membership</h3>
              <button
                type="button"
                onClick={handleClose}
                className="rounded-lg p-2 text-slate-400 hover:bg-white/5 hover:text-slate-200"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {paymentLink ? (
              <div className="space-y-4">
                <p className="text-sm text-slate-300">
                  A pending membership has been created and the payment link has been emailed to the member. You can also copy it here.
                </p>
                <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 p-3">
                  <input
                    type="text"
                    value={paymentLink}
                    readOnly
                    className="flex-1 bg-transparent text-xs text-slate-200 outline-none"
                  />
                  <button
                    type="button"
                    onClick={handleCopy}
                    className="inline-flex items-center gap-1 text-xs text-neon-blue hover:underline"
                  >
                    {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                    {copied ? 'Copied' : 'Copy'}
                  </button>
                </div>
                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={handleClose}
                    className="rounded-xl bg-neon-blue px-5 py-2.5 text-sm font-semibold text-white hover:bg-neon-blue/90"
                  >
                    Done
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <div>
                  <label className="mb-2 block text-sm font-medium text-slate-300">Membership Type</label>
                  {typesLoading ? (
                    <div className="flex h-10 items-center gap-2 text-sm text-slate-500">
                      <Loader2 className="h-4 w-4 animate-spin" /> Loading types…
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
                    disabled={isPaidSelected}
                    className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-slate-100 outline-none focus:border-neon-blue disabled:opacity-50"
                  >
                    {Object.values(MembershipStatus).map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                  {isPaidSelected && (
                    <p className="mt-1 text-xs text-slate-500">
                      Status is fixed for paid memberships: pending for online payment, active for offline payment.
                    </p>
                  )}
                </div>

                {isPaidSelected && (
                  <div>
                    <label className="mb-2 block text-sm font-medium text-slate-300">Payment</label>
                    <div className="flex gap-3">
                      <button
                        type="button"
                        onClick={() => setPaymentMode('online')}
                        className={cn(
                          'flex-1 rounded-xl border px-4 py-2.5 text-sm font-medium transition-colors',
                          paymentMode === 'online'
                            ? 'border-neon-blue bg-neon-blue/10 text-neon-blue'
                            : 'border-white/10 bg-white/5 text-slate-300 hover:bg-white/10'
                        )}
                      >
                        Send payment link
                      </button>
                      <button
                        type="button"
                        onClick={() => setPaymentMode('offline')}
                        className={cn(
                          'flex-1 rounded-xl border px-4 py-2.5 text-sm font-medium transition-colors',
                          paymentMode === 'offline'
                            ? 'border-neon-blue bg-neon-blue/10 text-neon-blue'
                            : 'border-white/10 bg-white/5 text-slate-300 hover:bg-white/10'
                        )}
                      >
                        Paid offline
                      </button>
                    </div>
                  </div>
                )}

                <div className="rounded-xl border border-white/10 bg-white/5 p-4">
                  <label className="mb-3 block text-sm font-medium text-slate-300">Dependants</label>
                  {dependants.length === 0 && (
                    <p className="mb-3 text-xs text-slate-500">No dependants added yet.</p>
                  )}
                  <div className="space-y-3">
                    {dependants.map((dep, idx) => (
                      <div key={idx} className="rounded-lg border border-white/10 bg-white/5 p-3">
                        <div className="mb-2 flex items-center justify-between">
                          <span className="text-xs font-semibold capitalize text-slate-400">{dep.relationship}</span>
                          <button
                            type="button"
                            onClick={() => setDependants((prev) => prev.filter((_, i) => i !== idx))}
                            className="text-red-400 hover:text-red-300"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                        <div className="grid gap-3 sm:grid-cols-3">
                          <input
                            type="text"
                            placeholder="Name"
                            value={dep.name}
                            onChange={(e) =>
                              setDependants((prev) =>
                                prev.map((d, i) => (i === idx ? { ...d, name: e.target.value } : d))
                              )
                            }
                            className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-slate-100 outline-none focus:border-neon-blue"
                          />
                          <input
                            type="number"
                            min={0}
                            max={120}
                            placeholder="Age"
                            value={dep.age}
                            onChange={(e) =>
                              setDependants((prev) =>
                                prev.map((d, i) =>
                                  i === idx ? { ...d, age: Number(e.target.value) || 0 } : d
                                )
                              )
                            }
                            className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-slate-100 outline-none focus:border-neon-blue"
                          />
                          <select
                            value={dep.relationship}
                            onChange={(e) =>
                              setDependants((prev) =>
                                prev.map((d, i) =>
                                  i === idx
                                    ? { ...d, relationship: e.target.value as 'spouse' | 'child' }
                                    : d
                                )
                              )
                            }
                            className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-slate-100 outline-none focus:border-neon-blue"
                          >
                            <option value="spouse">Spouse</option>
                            <option value="child">Child</option>
                          </select>
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {!dependants.some((d) => d.relationship === 'spouse') && (
                      <button
                        type="button"
                        onClick={() => setDependants((prev) => [...prev, { name: '', age: 0, relationship: 'spouse' }])}
                        className="inline-flex items-center gap-1 rounded-lg bg-neon-gold/10 px-3 py-1.5 text-xs font-semibold text-neon-gold hover:bg-neon-gold/20"
                      >
                        <Plus className="h-3 w-3" /> Add spouse
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => setDependants((prev) => [...prev, { name: '', age: 0, relationship: 'child' }])}
                      className="inline-flex items-center gap-1 rounded-lg bg-neon-blue/10 px-3 py-1.5 text-xs font-semibold text-neon-blue hover:bg-neon-blue/20"
                    >
                      <Plus className="h-3 w-3" /> Add child
                    </button>
                  </div>
                </div>

                {error && (
                  <div className="rounded-xl bg-red-500/10 p-3 text-sm text-red-400">
                    {error}
                  </div>
                )}

                <div className="flex justify-end gap-3 pt-2">
                  <button
                    type="button"
                    onClick={handleClose}
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
            )}
          </div>
        </div>
      )}
    </div>
  );
}
