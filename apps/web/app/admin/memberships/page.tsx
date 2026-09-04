'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Loader2, Users, Mail, FileSpreadsheet } from 'lucide-react';
import { api, getApiErrorMessage } from '@/lib/api';
import { AdminListLayout } from '@/components/admin/AdminListLayout';
import { MembershipsList } from './MembershipsList';
import type { AdminMembership, ExportedMembership } from './types';

const STATUS_OPTIONS = [
  { value: 'ALL', label: 'All statuses' },
  { value: 'PENDING', label: 'Pending' },
  { value: 'AWAITING_APPROVAL', label: 'Awaiting approval' },
  { value: 'AWAITING_PAYMENT', label: 'Awaiting payment' },
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

  const exportQuery = useQuery<ExportedMembership[]>({
    queryKey: ['admin', 'memberships', 'export', status],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (status !== 'ALL') params.append('status', status);
      const res = await api.get(`/admin/memberships/export?${params.toString()}`);
      return res.data;
    },
    enabled: false
  });

  const handleExport = async () => {
    const result = await exportQuery.refetch();
    if (!result.data?.length) return;

    const XLSX = await import('xlsx');

    const rows = result.data.map((m) => ({
      'Membership ID': m.membershipId,
      'Membership Status': m.membershipStatus,
      'Membership Type': m.membershipType,
      'Membership Type Description': m.membershipTypeDescription,
      'Membership Price': m.membershipPrice,
      'Duration (Months)': m.membershipDurationMonths,
      'Start Date': m.startDate ? new Date(m.startDate).toLocaleDateString('en-GB') : '',
      'End Date': m.endDate ? new Date(m.endDate).toLocaleDateString('en-GB') : '',
      'Issued At': m.issuedAt ? new Date(m.issuedAt).toLocaleString('en-GB') : '',
      'Paid At': m.paidAt ? new Date(m.paidAt).toLocaleString('en-GB') : '',
      'Payment Method': m.paymentMethod,
      'Subscription Status': m.subscriptionStatus,
      'Credit Applied': m.creditAmountApplied ?? 0,
      'Credit Months': m.creditMonthsGranted ?? 0,
      'Card URL': m.membershipCardUrl,
      'QR Code': m.qrCodeValue,
      'Dependants Count': m.dependantsCount,
      Dependants: m.dependants,
      'Member ID': m.memberId,
      'Member Name': m.memberName,
      'First Name': m.memberFirstName,
      'Last Name': m.memberLastName,
      Email: m.memberEmail,
      Phone: m.memberPhone,
      'Member Role': m.memberRole,
      'Member Status': m.memberStatus,
      'Email Verified At': m.memberEmailVerifiedAt
        ? new Date(m.memberEmailVerifiedAt).toLocaleString('en-GB')
        : '',
      'Member Since': m.memberCreatedAt ? new Date(m.memberCreatedAt).toLocaleDateString('en-GB') : '',
      'Building / Street': m.buildingStreet,
      Locality: m.locality,
      'Town / City': m.townCity,
      Postcode: m.postcode
    }));

    const worksheet = XLSX.utils.json_to_sheet(rows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Members');
    XLSX.writeFile(workbook, `kentslsc-members-${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

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

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <button
              type="button"
              onClick={handleExport}
              disabled={exportQuery.isFetching}
              className="inline-flex items-center gap-2 rounded-xl bg-neon-blue/10 px-4 py-2 text-sm font-semibold text-neon-blue transition-colors hover:bg-neon-blue/20 disabled:opacity-50"
            >
              {exportQuery.isFetching ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <FileSpreadsheet className="h-4 w-4" />
              )}
              Export full details
            </button>

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
