'use client';

import { useState, useEffect } from 'react';
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
  Hash,
  Banknote,
  Copy,
  Check,
  Plus,
  Trash2
} from 'lucide-react';
import { api, getApiErrorMessage } from '@/lib/api';
import { formatDate, formatCurrency } from '@/lib/utils';
import type { AdminMembership } from '../../types';

const STATUSES = ['PENDING', 'AWAITING_APPROVAL', 'AWAITING_PAYMENT', 'ACTIVE', 'EXPIRED', 'CANCELLED'] as const;

function statusLabel(status: string) {
  if (status === 'AWAITING_APPROVAL') return 'Awaiting approval';
  if (status === 'AWAITING_PAYMENT') return 'Awaiting payment';
  return status;
}

const PROGRESS_STEPS = [
  { key: 'FORM_SUBMITTED', label: 'Form submitted' },
  { key: 'AWAITING_APPROVAL', label: 'Awaiting approval' },
  { key: 'AWAITING_PAYMENT', label: 'Payment link sent' },
  { key: 'PAYMENT_PROCESSED', label: 'Payment processed' },
  { key: 'APPROVED', label: 'Approved' }
] as const;

function ProgressTracker({ stage }: { stage?: AdminMembership['progressStage'] }) {
  if (stage === 'REJECTED') {
    return (
      <div className="flex items-center gap-2 rounded-xl bg-red-500/10 px-4 py-3 text-sm font-medium text-red-400">
        <XCircle className="h-4 w-4" /> Application rejected
      </div>
    );
  }

  const activeIndex = PROGRESS_STEPS.findIndex((s) => s.key === stage);

  return (
    <div className="flex flex-wrap items-center gap-2">
      {PROGRESS_STEPS.map((step, index) => {
        const done = activeIndex >= 0 && index <= activeIndex;
        return (
          <div key={step.key} className="flex items-center gap-2">
            <span
              className={`rounded-full px-3 py-1 text-xs font-semibold ${
                done ? 'bg-green-500/15 text-green-400' : 'bg-white/5 text-slate-500'
              }`}
            >
              {step.label}
            </span>
            {index < PROGRESS_STEPS.length - 1 && <span className="text-slate-600">→</span>}
          </div>
        );
      })}
    </div>
  );
}

interface MembershipDetailsFormProps {
  membership: AdminMembership;
}

export function MembershipDetailsForm({ membership }: MembershipDetailsFormProps) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [status, setStatus] = useState(membership.status);
  const [error, setError] = useState<string | null>(null);
  const [paymentLink, setPaymentLink] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const [dependants, setDependants] = useState(membership.dependants ?? []);
  const [dependantsError, setDependantsError] = useState<string | null>(null);
  const [dependantsSuccess, setDependantsSuccess] = useState(false);

  useEffect(() => {
    setDependants(membership.dependants ?? []);
  }, [membership.dependants?.length]);

  const dependantsMutation = useMutation({
    mutationFn: async () => {
      const res = await api.put(`/admin/memberships/${membership.id}/dependants`, { dependants });
      return res.data;
    },
    onSuccess: () => {
      setDependantsError(null);
      setDependantsSuccess(true);
      setTimeout(() => setDependantsSuccess(false), 3000);
      queryClient.invalidateQueries({ queryKey: ['admin', 'memberships'] });
      router.refresh();
    },
    onError: (err) => {
      setDependantsError(getApiErrorMessage(err));
      setDependantsSuccess(false);
    }
  });

  const statusMutation = useMutation({
    mutationFn: async ({ nextStatus, confirmManualPayment }: { nextStatus: string; confirmManualPayment?: boolean }) => {
      const res = await api.put(`/admin/memberships/${membership.id}/status`, {
        status: nextStatus,
        confirmManualPayment
      });
      return res.data;
    },
    onSuccess: () => {
      setError(null);
      queryClient.invalidateQueries({ queryKey: ['admin', 'memberships'] });
      router.refresh();
    },
    onError: (err) => setError(getApiErrorMessage(err))
  });

  const rejectMutation = useMutation({
    mutationFn: async () => {
      const reason = window.prompt('Reason for rejecting this application (optional). The member will be refunded and notified.') ?? undefined;
      const res = await api.post(`/admin/memberships/${membership.id}/reject`, { reason });
      return res.data;
    },
    onSuccess: () => {
      setError(null);
      queryClient.invalidateQueries({ queryKey: ['admin', 'memberships'] });
      router.refresh();
    },
    onError: (err) => setError(getApiErrorMessage(err))
  });

  const sendLinkMutation = useMutation({
    mutationFn: async () => {
      const res = await api.post(`/admin/memberships/${membership.id}/send-payment-link`);
      return res.data as { url: string; provider: string };
    },
    onSuccess: (data) => {
      setPaymentLink(data.url);
      setCopied(false);
      setError(null);
    },
    onError: (err) => setError(getApiErrorMessage(err))
  });

  const approveMutation = useMutation({
    mutationFn: async () => {
      const res = await api.post(`/admin/memberships/${membership.id}/approve`);
      return res.data as { url: string; provider: string };
    },
    onSuccess: (data) => {
      setPaymentLink(data.url);
      setCopied(false);
      setError(null);
      queryClient.invalidateQueries({ queryKey: ['admin', 'memberships'] });
      router.refresh();
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

  const handleApprove = () => {
    const isPaidType =
      membership.membershipType.isFree === false &&
      typeof membership.membershipType.price === 'number' &&
      membership.membershipType.price > 0;
    if (isPaidType && !membership.paymentMethod) {
      if (!window.confirm('Approve this application and send the member a payment link?')) return;
      approveMutation.mutate();
      return;
    }
    // Free or already-paid memberships can be activated directly.
    statusMutation.mutate({ nextStatus: 'ACTIVE' });
  };
  const handleReject = () => rejectMutation.mutate();
  const handleSaveStatus = () => statusMutation.mutate({ nextStatus: status });

  const isExpired = membership.endDate ? new Date(membership.endDate) < new Date() : false;

  return (
    <div className="max-w-3xl space-y-6">
      <section className="glass-card p-6">
        <h2 className="mb-4 text-lg font-semibold">Progress</h2>
        <ProgressTracker stage={membership.progressStage} />
        {membership.rejectionReason && (
          <p className="mt-3 text-sm text-red-400">Rejection reason: {membership.rejectionReason}</p>
        )}
      </section>

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

          {membership.membershipType.isFree === false && typeof membership.membershipType.price === 'number' && membership.membershipType.price > 0 && (
            <div className="flex items-start gap-3">
              <Banknote className="mt-0.5 h-4 w-4 text-slate-500" />
              <div>
                <p className="text-xs text-slate-500">Payment</p>
                {membership.paymentMethod ? (
                  <p className="text-sm font-medium text-green-400">
                    Paid {membership.paymentMethod}
                    {membership.paidAt && ` · ${formatDate(membership.paidAt)}`}
                  </p>
                ) : (
                  <p className="text-sm font-medium text-yellow-400">Unpaid</p>
                )}
              </div>
            </div>
          )}
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
                {statusLabel(s)}
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

        {(membership.status === 'PENDING' || membership.status === 'AWAITING_APPROVAL') && (
          <div className="mt-4 flex flex-wrap gap-3">
            <button
              type="button"
              onClick={handleApprove}
              disabled={statusMutation.isPending || approveMutation.isPending}
              className="inline-flex items-center gap-2 rounded-xl bg-green-500/10 px-4 py-2 text-sm font-semibold text-green-400 transition-colors hover:bg-green-500/20 disabled:opacity-50"
            >
              {approveMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <CheckCircle className="h-4 w-4" />
              )}
              Approve
            </button>
            <button
              type="button"
              onClick={handleReject}
              disabled={statusMutation.isPending || rejectMutation.isPending || approveMutation.isPending}
              className="inline-flex items-center gap-2 rounded-xl bg-red-500/10 px-4 py-2 text-sm font-semibold text-red-400 transition-colors hover:bg-red-500/20 disabled:opacity-50"
            >
              {rejectMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <XCircle className="h-4 w-4" />
              )}
              Reject &amp; refund
            </button>
          </div>
        )}

        {(membership.status === 'PENDING' || membership.status === 'AWAITING_PAYMENT') &&
          membership.membershipType.isFree === false &&
          typeof membership.membershipType.price === 'number' &&
          membership.membershipType.price > 0 &&
          !membership.paymentMethod && (
          <div className="mt-4 space-y-3">
            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                onClick={() => sendLinkMutation.mutate()}
                disabled={sendLinkMutation.isPending}
                className="inline-flex items-center gap-2 rounded-xl bg-neon-blue/10 px-4 py-2 text-sm font-semibold text-neon-blue transition-colors hover:bg-neon-blue/20 disabled:opacity-50"
              >
                {sendLinkMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Mail className="h-4 w-4" />
                )}
                Resend payment link
              </button>
            </div>
            {paymentLink && (
              <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 p-2">
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
                  {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                  {copied ? 'Copied' : 'Copy'}
                </button>
              </div>
            )}
          </div>
        )}

        {error && <p className="mt-3 text-sm text-red-400">{error}</p>}
      </section>

      <section className="glass-card p-6">
        <div className="mb-4 flex items-center gap-2">
          <Users className="h-5 w-5 text-slate-500" />
          <h2 className="text-lg font-semibold">Dependants</h2>
        </div>

        <div className="space-y-4">
          {dependants.length === 0 && (
            <p className="text-sm text-slate-500">No dependants on this membership.</p>
          )}

          {dependants.map((dependant, idx) => (
              <div
                key={idx}
                className="rounded-xl border border-white/10 bg-white/5 p-4"
              >
                <div className="mb-3 flex items-center justify-between">
                  <span className="text-sm font-semibold capitalize text-slate-300">
                    {dependant.relationship}
                  </span>
                  <button
                    type="button"
                    onClick={() => setDependants((prev) => prev.filter((_, i) => i !== idx))}
                    className="text-red-400 hover:text-red-300"
                    title="Remove dependant"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
                <div className="grid gap-4 sm:grid-cols-3">
                  <div>
                    <label className="mb-1 block text-xs text-slate-500">Name</label>
                    <input
                      type="text"
                      value={dependant.name}
                      onChange={(e) =>
                        setDependants((prev) =>
                          prev.map((d, i) => (i === idx ? { ...d, name: e.target.value } : d))
                        )
                      }
                      className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-slate-100 outline-none focus:border-neon-blue"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs text-slate-500">Age</label>
                    <input
                      type="number"
                      min={0}
                      max={120}
                      value={dependant.age}
                      onChange={(e) =>
                        setDependants((prev) =>
                          prev.map((d, i) =>
                            i === idx ? { ...d, age: Number(e.target.value) || 0 } : d
                          )
                        )
                      }
                      className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-slate-100 outline-none focus:border-neon-blue"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs text-slate-500">Relationship</label>
                    <select
                      value={dependant.relationship}
                      onChange={(e) =>
                        setDependants((prev) =>
                          prev.map((d, i) =>
                            i === idx
                              ? { ...d, relationship: e.target.value as 'spouse' | 'child' }
                              : d
                          )
                        )
                      }
                      className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-slate-100 outline-none focus:border-neon-blue"
                    >
                      <option value="spouse">Spouse</option>
                      <option value="child">Child</option>
                    </select>
                  </div>
                </div>
              </div>
            ))}

            <div className="flex flex-wrap gap-3">
              {!dependants.some((d) => d.relationship === 'spouse') && (
                <button
                  type="button"
                  onClick={() => setDependants((prev) => [...prev, { name: '', age: 0, relationship: 'spouse' }])}
                  className="inline-flex items-center gap-2 rounded-xl bg-neon-gold/10 px-4 py-2 text-sm font-semibold text-neon-gold transition-colors hover:bg-neon-gold/20"
                >
                  <Plus className="h-4 w-4" /> Add spouse
                </button>
              )}
              <button
                type="button"
                onClick={() => setDependants((prev) => [...prev, { name: '', age: 0, relationship: 'child' }])}
                className="inline-flex items-center gap-2 rounded-xl bg-neon-blue/10 px-4 py-2 text-sm font-semibold text-neon-blue transition-colors hover:bg-neon-blue/20"
              >
                <Plus className="h-4 w-4" /> Add child
              </button>
            </div>

            <button
              type="button"
              onClick={() => dependantsMutation.mutate()}
              disabled={dependantsMutation.isPending}
              className="btn-primary inline-flex items-center gap-2 disabled:opacity-50"
            >
              {dependantsMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Save className="h-4 w-4" />
              )}
              Save dependants
            </button>

          {dependantsSuccess && (
            <p className="text-sm text-green-400">Dependants saved successfully.</p>
          )}
          {dependantsError && (
            <p className="text-sm text-red-400">{dependantsError}</p>
          )}
        </div>
      </section>
    </div>
  );
}
