'use client';

import { useMemo, useRef, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Loader2,
  Download,
  FileSpreadsheet,
  FileText,
  Search,
  RefreshCw,
  CreditCard,
  RotateCcw,
  AlertCircle
} from 'lucide-react';
import { api } from '@/lib/api';
import { formatCurrency } from '@/lib/utils';
import * as XLSX from 'xlsx';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

interface ReportRow {
  id: string;
  date: string;
  receiptNumber: string | null;
  name: string | null;
  addressLine1: string | null;
  addressLine2: string | null;
  city: string | null;
  postcode: string | null;
  country: string | null;
  contactNumber: string | null;
  email: string | null;
  notes: string | null;
  currency: string;
  amount: number;
  fees: number;
  netPayment: number;
  refundedAmount: number | null;
  paymentChannel: string;
  paymentId: string | null;
  paymentDate: string | null;
  paymentMethod: string | null;
  paymentStatus: string;
  sourceType: string;
  sourceId: string | null;
  description: string | null;
  createdAt: string;
}

interface ReportResponse {
  rows: ReportRow[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  aggregates: {
    gross: number;
    fees: number;
    net: number;
    refunded: number;
  };
}

const sourceTypeOptions = [
  { value: '', label: 'All sources' },
  { value: 'TICKET', label: 'Tickets' },
  { value: 'MEMBERSHIP', label: 'Memberships' },
  { value: 'DONATION', label: 'Donations' },
  { value: 'DIRECTORY_PROMOTION', label: 'Directory promotions' },
  { value: 'JOB_PUBLISH', label: 'Job publishes' },
  { value: 'MANUAL', label: 'Manual / free' }
];

const statusOptions = [
  { value: '', label: 'All statuses' },
  { value: 'COMPLETED', label: 'Completed' },
  { value: 'PENDING', label: 'Pending' },
  { value: 'FAILED', label: 'Failed' },
  { value: 'REFUNDED', label: 'Refunded' },
  { value: 'PARTIALLY_REFUNDED', label: 'Partially refunded' }
];

const channelOptions = [
  { value: '', label: 'All channels' },
  { value: 'stripe', label: 'Stripe' },
  { value: 'paypal', label: 'PayPal' },
  { value: 'offline', label: 'Offline' },
  { value: 'free', label: 'Free' },
  { value: 'manual', label: 'Manual' }
];

const inputClass =
  'w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm outline-none focus:border-neon-blue';
const labelClass = 'mb-1 block text-xs text-slate-500';

export default function RevenueReportPage() {
  const queryClient = useQueryClient();
  const tableRef = useRef<HTMLTableElement>(null);

  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [sourceType, setSourceType] = useState('');
  const [channel, setChannel] = useState('');
  const [status, setStatus] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const limit = 50;

  const [refundPayment, setRefundPayment] = useState<ReportRow | null>(null);
  const [refundAmount, setRefundAmount] = useState('');
  const [refundReason, setRefundReason] = useState('');
  const [syncMessage, setSyncMessage] = useState<string | null>(null);

  const filters = useMemo(
    () => ({
      from,
      to,
      sourceType,
      channel,
      status,
      search,
      page,
      limit
    }),
    [from, to, sourceType, channel, status, search, page]
  );

  const { data, isLoading, error, refetch } = useQuery<ReportResponse>({
    queryKey: ['payments', 'reports', 'revenue', filters],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (filters.from) params.set('from', filters.from);
      if (filters.to) params.set('to', filters.to);
      if (filters.sourceType) params.set('sourceType', filters.sourceType);
      if (filters.channel) params.set('channel', filters.channel);
      if (filters.status) params.set('status', filters.status);
      if (filters.search) params.set('search', filters.search);
      params.set('page', String(filters.page));
      params.set('limit', String(filters.limit));
      const { data } = await api.get(`/payments/reports/revenue?${params.toString()}`);
      return data;
    }
  });

  const exportQuery = useQuery<ReportRow[]>({
    queryKey: ['payments', 'reports', 'export', { from, to, sourceType, channel, status, search }],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (from) params.set('from', from);
      if (to) params.set('to', to);
      if (sourceType) params.set('sourceType', sourceType);
      if (channel) params.set('channel', channel);
      if (status) params.set('status', status);
      if (search) params.set('search', search);
      const { data } = await api.get(`/payments/reports/export?${params.toString()}`);
      return data;
    },
    enabled: false
  });

  const syncMutation = useMutation<{
    created: number;
    updated: number;
    skipped: number;
    errors: string[];
  }>({
    mutationFn: async () => {
      const { data } = await api.post('/payments/reports/sync-stripe', {
        from: from || undefined,
        to: to || undefined
      });
      return data;
    },
    onSuccess: (result) => {
      const parts = [
        result.created > 0 && `${result.created} created`,
        result.updated > 0 && `${result.updated} updated`,
        result.skipped > 0 && `${result.skipped} skipped`
      ].filter(Boolean);
      const summary = parts.length > 0 ? parts.join(', ') : 'Already up to date';
      setSyncMessage(
        `Sync complete: ${summary}.${result.errors.length > 0 ? ` ${result.errors.length} error(s).` : ''}`
      );
      void queryClient.invalidateQueries({ queryKey: ['payments', 'reports'] });
      void refetch();
    },
    onError: (err: any) => {
      setSyncMessage(
        `Sync failed: ${err?.response?.data?.message ?? err?.message ?? 'Unknown error'}`
      );
    }
  });

  const refundMutation = useMutation({
    mutationFn: async (input: { id: string; amount?: number; reason?: string }) => {
      const { data } = await api.post(`/payments/${input.id}/refund`, {
        amount: input.amount,
        reason: input.reason
      });
      return data;
    },
    onSuccess: () => {
      setRefundPayment(null);
      setRefundAmount('');
      setRefundReason('');
      void queryClient.invalidateQueries({ queryKey: ['payments', 'reports'] });
      void refetch();
    }
  });

  const allRows = data?.rows ?? [];
  const agg = data?.aggregates;

  const columns = [
    { key: 'date', label: 'Date', width: 90 },
    { key: 'receiptNumber', label: 'Receipt #', width: 110 },
    { key: 'name', label: 'Name', width: 120 },
    { key: 'addressLine1', label: 'Address 1', width: 100 },
    { key: 'addressLine2', label: 'Address 2', width: 100 },
    { key: 'city', label: 'City', width: 90 },
    { key: 'postcode', label: 'Postcode', width: 80 },
    { key: 'country', label: 'Country', width: 60 },
    { key: 'contactNumber', label: 'Contact', width: 100 },
    { key: 'email', label: 'Email', width: 150 },
    { key: 'sourceType', label: 'Source', width: 80 },
    { key: 'currency', label: 'Currency', width: 60 },
    { key: 'amount', label: 'Amount', width: 80 },
    { key: 'fees', label: 'Fees', width: 70 },
    { key: 'netPayment', label: 'Net', width: 80 },
    { key: 'refundedAmount', label: 'Refunded', width: 80 },
    { key: 'paymentChannel', label: 'Channel', width: 80 },
    { key: 'paymentId', label: 'Payment ID', width: 120 },
    { key: 'paymentDate', label: 'Payment Date', width: 90 },
    { key: 'paymentMethod', label: 'Method', width: 80 },
    { key: 'paymentStatus', label: 'Status', width: 90 },
    { key: 'notes', label: 'Notes', width: 150 }
  ];

  const exportToExcel = async () => {
    const rows = await exportQuery.refetch();
    if (!rows.data?.length) return;

    const worksheetData = rows.data.map((row) => ({
      Date: row.date ? new Date(row.date).toLocaleString() : '',
      'Receipt #': row.receiptNumber ?? '',
      Name: row.name ?? '',
      'Address 1': row.addressLine1 ?? '',
      'Address 2': row.addressLine2 ?? '',
      City: row.city ?? '',
      Postcode: row.postcode ?? '',
      Country: row.country ?? '',
      'Contact Number': row.contactNumber ?? '',
      Email: row.email ?? '',
      Notes: row.notes ?? '',
      Currency: row.currency,
      Amount: row.amount,
      Fees: row.fees,
      'Net Payment': row.netPayment,
      'Refunded Amount': row.refundedAmount ?? 0,
      'Payment Channel': row.paymentChannel,
      'Payment ID': row.paymentId ?? '',
      'Payment Date': row.paymentDate ? new Date(row.paymentDate).toLocaleString() : '',
      'Payment Method': row.paymentMethod ?? '',
      'Payment Status': row.paymentStatus,
      Source: row.sourceType,
      'Source ID': row.sourceId ?? ''
    }));

    const worksheet = XLSX.utils.json_to_sheet(worksheetData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Revenue Report');
    XLSX.writeFile(workbook, `kentslsc-revenue-report-${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  const exportToPDF = async () => {
    const rows = await exportQuery.refetch();
    if (!rows.data?.length) return;

    const doc = new jsPDF({ orientation: 'landscape' });
    doc.setFontSize(14);
    doc.text('Kent SLSC Revenue Report', 14, 15);
    doc.setFontSize(10);
    doc.text(`Generated ${new Date().toLocaleString()}`, 14, 22);

    const body = rows.data.map((row) => [
      row.date ? new Date(row.date).toLocaleDateString() : '',
      row.receiptNumber ?? '',
      row.name ?? '',
      row.addressLine1 ?? '',
      row.city ?? '',
      row.postcode ?? '',
      row.country ?? '',
      row.contactNumber ?? '',
      row.email ?? '',
      row.sourceType,
      formatCurrency(row.amount),
      formatCurrency(row.fees),
      formatCurrency(row.netPayment),
      row.paymentChannel,
      row.paymentStatus
    ]);

    autoTable(doc, {
      startY: 28,
      head: [
        ['Date', 'Receipt #', 'Name', 'Address 1', 'City', 'Postcode', 'Country', 'Contact', 'Email', 'Source', 'Amount', 'Fees', 'Net', 'Channel', 'Status']
      ],
      body,
      styles: { fontSize: 8 },
      headStyles: { fillColor: [30, 41, 59] },
      didDrawPage: (d) => {
        doc.setFontSize(8);
        doc.text(`Page ${(d.pageNumber ?? 1).toString()}`, 14, (d.cursor?.y ?? 280) + 10);
      }
    });

    doc.save(`kentslsc-revenue-report-${new Date().toISOString().slice(0, 10)}.pdf`);
  };

  const formatMoney = (value?: number | null) =>
    value != null ? formatCurrency(value) : '-';

  return (
    <div>
      <div className="flex items-center gap-3">
        <CreditCard className="h-6 w-6 text-neon-blue" />
        <div>
          <h1 className="section-title">Revenue Report</h1>
          <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
            View, filter, refund and export payments from tickets, memberships, donations, and directory promotions.
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="mt-8 grid gap-4 rounded-2xl border border-white/10 bg-white/5 p-4 md:grid-cols-4">
        <div>
          <label className={labelClass}>From</label>
          <input type="date" value={from} onChange={(e) => { setFrom(e.target.value); setPage(1); }} className={inputClass} />
        </div>
        <div>
          <label className={labelClass}>To</label>
          <input type="date" value={to} onChange={(e) => { setTo(e.target.value); setPage(1); }} className={inputClass} />
        </div>
        <div>
          <label className={labelClass}>Source</label>
          <select value={sourceType} onChange={(e) => { setSourceType(e.target.value); setPage(1); }} className={inputClass}>
            {sourceTypeOptions.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>
        <div>
          <label className={labelClass}>Channel</label>
          <select value={channel} onChange={(e) => { setChannel(e.target.value); setPage(1); }} className={inputClass}>
            {channelOptions.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>
        <div>
          <label className={labelClass}>Status</label>
          <select value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }} className={inputClass}>
            {statusOptions.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>
        <div className="md:col-span-3">
          <label className={labelClass}>Search</label>
          <div className="relative">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-500" />
            <input
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              placeholder="Search by name, email, receipt #, payment ID, notes..."
              className={`${inputClass} pl-9`}
            />
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={() => {
            setSyncMessage(null);
            syncMutation.mutate();
          }}
          disabled={syncMutation.isPending || isLoading}
          className="btn-secondary inline-flex items-center gap-2"
        >
          {syncMutation.isPending || isLoading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <RefreshCw className="h-4 w-4" />
          )}
          Refresh
        </button>
        <button
          type="button"
          onClick={exportToExcel}
          disabled={exportQuery.isFetching}
          className="btn-secondary inline-flex items-center gap-2"
        >
          <FileSpreadsheet className="h-4 w-4" />
          Export Excel
        </button>
        <button
          type="button"
          onClick={exportToPDF}
          disabled={exportQuery.isFetching}
          className="btn-secondary inline-flex items-center gap-2"
        >
          <FileText className="h-4 w-4" />
          Export PDF
        </button>
      </div>

      {/* Sync message */}
      {syncMessage && (
        <div
          className={`mt-4 rounded-xl border px-4 py-3 text-sm ${
            syncMessage.startsWith('Sync failed')
              ? 'border-red-500/20 bg-red-500/10 text-red-600 dark:text-red-400'
              : 'border-green-500/20 bg-green-500/10 text-green-600 dark:text-green-400'
          }`}
        >
          {syncMessage}
        </div>
      )}

      {/* Aggregates */}
      {agg && (
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="glass-card p-4">
            <p className="text-xs text-slate-500">Gross revenue</p>
            <p className="mt-1 text-lg font-semibold">{formatCurrency(agg.gross)}</p>
          </div>
          <div className="glass-card p-4">
            <p className="text-xs text-slate-500">Processing fees</p>
            <p className="mt-1 text-lg font-semibold">{formatCurrency(agg.fees)}</p>
          </div>
          <div className="glass-card p-4">
            <p className="text-xs text-slate-500">Net revenue</p>
            <p className="mt-1 text-lg font-semibold">{formatCurrency(agg.net)}</p>
          </div>
          <div className="glass-card p-4">
            <p className="text-xs text-slate-500">Refunded</p>
            <p className="mt-1 text-lg font-semibold">{formatCurrency(agg.refunded)}</p>
          </div>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="mt-6 flex items-center gap-2 rounded-xl border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-600 dark:text-red-400">
          <AlertCircle className="h-4 w-4" />
          Could not load the revenue report.
        </div>
      )}

      {/* Table */}
      <div className="mt-6 overflow-x-auto rounded-2xl border border-white/10 bg-white/5">
        <table ref={tableRef} className="w-full text-left text-sm">
          <thead className="bg-slate-900/50 text-xs uppercase text-slate-400">
            <tr>
              {columns.map((col) => (
                <th key={col.key} className="whitespace-nowrap px-4 py-3 font-medium">
                  {col.label}
                </th>
              ))}
              <th className="px-4 py-3 font-medium">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {isLoading && (
              <tr>
                <td colSpan={columns.length + 1} className="px-4 py-12 text-center">
                  <Loader2 className="mx-auto h-6 w-6 animate-spin text-neon-blue" />
                </td>
              </tr>
            )}
            {!isLoading && allRows.length === 0 && (
              <tr>
                <td colSpan={columns.length + 1} className="px-4 py-12 text-center text-slate-500">
                  No payments match the selected filters.
                </td>
              </tr>
            )}
            {allRows.map((row) => (
              <tr key={row.id} className="hover:bg-white/[0.02]">
                {columns.map((col) => {
                  let value: React.ReactNode = row[col.key as keyof ReportRow] as React.ReactNode;
                  if (['amount', 'fees', 'netPayment', 'refundedAmount'].includes(col.key)) {
                    value = formatMoney(row[col.key as keyof ReportRow] as number | null);
                  } else if (col.key === 'date' || col.key === 'paymentDate') {
                    value = value ? new Date(value as string).toLocaleDateString() : '-';
                  } else if (col.key === 'paymentStatus') {
                    value = (
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                          row.paymentStatus === 'COMPLETED'
                            ? 'bg-green-500/10 text-green-400'
                            : row.paymentStatus === 'REFUNDED' || row.paymentStatus === 'PARTIALLY_REFUNDED'
                              ? 'bg-amber-500/10 text-amber-400'
                              : 'bg-slate-500/10 text-slate-400'
                        }`}
                      >
                        {row.paymentStatus}
                      </span>
                    );
                  }
                  return (
                    <td key={col.key} className="max-w-[200px] truncate px-4 py-3">
                      {value ?? '-'}
                    </td>
                  );
                })}
                <td className="px-4 py-3">
                  {row.paymentStatus === 'COMPLETED' && (
                    <button
                      type="button"
                      onClick={() => {
                        setRefundPayment(row);
                        setRefundAmount(row.amount.toFixed(2));
                      }}
                      className="inline-flex items-center gap-1 rounded-lg bg-amber-500/10 px-2 py-1 text-xs font-medium text-amber-400 hover:bg-amber-500/20"
                    >
                      <RotateCcw className="h-3 w-3" /> Refund
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {data && data.totalPages > 1 && (
        <div className="mt-4 flex items-center justify-between text-sm">
          <p className="text-slate-500">
            Showing {(page - 1) * limit + 1} - {Math.min(page * limit, data.total)} of {data.total}
          </p>
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={page <= 1}
              onClick={() => setPage((p) => p - 1)}
              className="rounded-lg border border-white/10 bg-white/5 px-3 py-1 disabled:opacity-40"
            >
              Previous
            </button>
            <span className="text-slate-500">
              Page {page} of {data.totalPages}
            </span>
            <button
              type="button"
              disabled={page >= data.totalPages}
              onClick={() => setPage((p) => p + 1)}
              className="rounded-lg border border-white/10 bg-white/5 px-3 py-1 disabled:opacity-40"
            >
              Next
            </button>
          </div>
        </div>
      )}

      {/* Refund modal */}
      {refundPayment && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl border border-white/10 bg-slate-900 p-6 shadow-2xl">
            <h3 className="text-lg font-semibold">Refund payment</h3>
            <p className="mt-1 text-sm text-slate-400">
              Refund {refundPayment.sourceType.toLowerCase().replace('_', ' ')} payment for{' '}
              {refundPayment.name ?? refundPayment.email ?? 'this payer'}.
            </p>
            {refundPayment.sourceType === 'TICKET' && (
              <p className="mt-2 rounded-lg border border-amber-500/20 bg-amber-500/10 px-3 py-2 text-xs text-amber-400">
                This will cancel the associated ticket(s). They will no longer be valid for event entry.
              </p>
            )}

            <div className="mt-4 space-y-4">
              <div>
                <label className={labelClass}>Refund amount ({refundPayment.currency})</label>
                <input
                  type="number"
                  min={0.01}
                  step={0.01}
                  max={refundPayment.amount}
                  value={refundAmount}
                  onChange={(e) => setRefundAmount(e.target.value)}
                  className={inputClass}
                />
                <p className="mt-1 text-xs text-slate-500">
                  Maximum refundable: {formatCurrency(refundPayment.amount)}
                </p>
              </div>
              <div>
                <label className={labelClass}>Reason (optional)</label>
                <textarea
                  value={refundReason}
                  onChange={(e) => setRefundReason(e.target.value)}
                  rows={3}
                  className={inputClass}
                />
              </div>
            </div>

            {refundMutation.isError && (
              <p className="mt-4 text-sm text-red-400">
                {(refundMutation.error as { response?: { data?: { message?: string } } })?.response?.data?.message ??
                  'Refund failed. Please try again.'}
              </p>
            )}

            <div className="mt-6 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setRefundPayment(null)}
                className="rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-sm hover:bg-white/10"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={refundMutation.isPending}
                onClick={() =>
                  refundMutation.mutate({
                    id: refundPayment.id,
                    amount: refundAmount ? Number(refundAmount) : undefined,
                    reason: refundReason || undefined
                  })
                }
                className="btn-primary inline-flex items-center gap-2"
              >
                {refundMutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                Process refund
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
