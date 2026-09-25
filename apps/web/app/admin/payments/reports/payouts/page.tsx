'use client';

import { Fragment, useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Loader2,
  FileSpreadsheet,
  RefreshCw,
  CreditCard,
  AlertCircle,
  ChevronDown,
  ChevronRight,
  Wallet,
  Clock
} from 'lucide-react';
import { formatCurrency, formatDate } from '@/lib/utils';
import {
  fetchBalanceSummary,
  fetchPayoutDetail,
  fetchPayoutReconciliation,
  syncPayouts,
  type BalanceSummaryResponse,
  type PayoutMatchStatus,
  type PayoutReconciliationResponse,
  type PayoutReconciliationRow,
  type PayoutDetailResponse
} from '@/lib/payout-reports';

const statusOptions = [
  { value: '', label: 'All statuses' },
  { value: 'paid', label: 'Paid' },
  { value: 'pending', label: 'Pending' },
  { value: 'in_transit', label: 'In transit' },
  { value: 'canceled', label: 'Canceled' },
  { value: 'failed', label: 'Failed' }
];

const matchStatusOptions: { value: '' | PayoutMatchStatus; label: string }[] = [
  { value: '', label: 'All matches' },
  { value: 'matched', label: 'Matched' },
  { value: 'unmatched', label: 'Unmatched' },
  { value: 'partial', label: 'Partial' }
];

const inputClass =
  'w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm outline-none focus:border-neon-blue';
const labelClass = 'mb-1 block text-xs text-slate-500';

export default function PayoutReconciliationPage() {
  const queryClient = useQueryClient();

  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [status, setStatus] = useState('');
  const [matchStatus, setMatchStatus] = useState<'' | PayoutMatchStatus>('');
  const [page, setPage] = useState(1);
  const limit = 50;

  const [expandedPayout, setExpandedPayout] = useState<string | null>(null);
  const [syncMessage, setSyncMessage] = useState<string | null>(null);

  const filters = useMemo(
    () => ({ from, to, status, matchStatus, page, limit }),
    [from, to, status, matchStatus, page]
  );

  const { data, isLoading, error, refetch } = useQuery<PayoutReconciliationResponse>({
    queryKey: ['payments', 'reports', 'payouts', filters],
    queryFn: () => fetchPayoutReconciliation(filters),
    refetchInterval: 15_000,
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: true,
    refetchOnReconnect: true
  });

  const balanceQuery = useQuery<BalanceSummaryResponse>({
    queryKey: ['payments', 'reports', 'balance'],
    queryFn: fetchBalanceSummary,
    refetchInterval: 60_000,
    refetchIntervalInBackground: false
  });

  const detailQuery = useQuery<PayoutDetailResponse>({
    queryKey: ['payments', 'reports', 'payouts', 'detail', expandedPayout],
    queryFn: () => fetchPayoutDetail(expandedPayout!),
    enabled: !!expandedPayout
  });

  const syncMutation = useMutation({
    mutationFn: () => syncPayouts(from || undefined),
    onSuccess: async (result) => {
      setSyncMessage(
        `Sync complete: ${result.payoutsUpserted} payout(s), ${result.transactionsUpserted} transaction(s) upserted.${
          result.errors.length > 0 ? ` ${result.errors.length} error(s).` : ''
        }`
      );
      await queryClient.invalidateQueries({ queryKey: ['payments', 'reports'] });
      await refetch();
    },
    onError: (err: any) => {
      setSyncMessage(
        `Sync failed: ${err?.response?.data?.message ?? err?.message ?? 'Unknown error'}`
      );
    }
  });

  const allRows = data?.rows ?? [];
  const agg = data?.aggregates;

  const exportToExcel = async () => {
    if (allRows.length === 0) return;

    const XLSX = await import('xlsx');

    const worksheetData = allRows.map((row) => ({
      'Arrival Date': formatDate(row.arrivalDate),
      'Payout ID': row.payoutId,
      Status: row.status,
      Currency: row.currency,
      Gross: row.gross,
      Fees: row.fees,
      Net: row.net,
      'Expected Ledger Net': row.expectedLedgerNet,
      'Matched Payments': row.matchedPaymentCount,
      'Unmatched Txns': row.unmatchedTxnCount,
      'Unmatched Amount': row.unmatchedAmount,
      Variance: row.variance
    }));

    const worksheet = XLSX.utils.json_to_sheet(worksheetData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Payout Reconciliation');
    XLSX.writeFile(
      workbook,
      `kentslsc-payout-reconciliation-${new Date().toISOString().slice(0, 10)}.xlsx`
    );
  };

  const togglePayout = (payoutId: string) => {
    setExpandedPayout((current) => (current === payoutId ? null : payoutId));
  };

  const available = balanceQuery.data?.available ?? [];
  const pending = balanceQuery.data?.pending ?? [];
  const availableTotal = available.find((b) => b.currency === 'gbp') ?? available[0];
  const pendingTotal = pending.find((b) => b.currency === 'gbp') ?? pending[0];

  const columns: { key: keyof PayoutReconciliationRow; label: string }[] = [
    { key: 'arrivalDate', label: 'Arrival date' },
    { key: 'payoutId', label: 'Payout ID' },
    { key: 'status', label: 'Status' },
    { key: 'gross', label: 'Gross' },
    { key: 'fees', label: 'Fees' },
    { key: 'net', label: 'Net' },
    { key: 'expectedLedgerNet', label: 'Expected ledger net' },
    { key: 'matchedPaymentCount', label: 'Matched' },
    { key: 'unmatchedTxnCount', label: 'Unmatched' },
    { key: 'variance', label: 'Variance' }
  ];

  return (
    <div>
      <div className="flex items-center gap-3">
        <CreditCard className="h-6 w-6 text-neon-blue" />
        <div>
          <h1 className="section-title">Payout Reconciliation</h1>
          <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
            Reconcile Stripe payouts and balance transactions against the internal payment ledger.
          </p>
        </div>
      </div>

      {/* Balance summary */}
      <div className="mt-8 grid gap-4 sm:grid-cols-2">
        <div className="glass-card flex items-center gap-3 p-4">
          <Wallet className="h-5 w-5 text-neon-blue" />
          <div>
            <p className="text-xs text-slate-500">Stripe balance available</p>
            <p className="mt-1 text-lg font-semibold">
              {balanceQuery.isLoading ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : availableTotal ? (
                formatCurrency(availableTotal.amount)
              ) : (
                '-'
              )}
            </p>
          </div>
        </div>
        <div className="glass-card flex items-center gap-3 p-4">
          <Clock className="h-5 w-5 text-amber-400" />
          <div>
            <p className="text-xs text-slate-500">Stripe balance pending</p>
            <p className="mt-1 text-lg font-semibold">
              {balanceQuery.isLoading ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : pendingTotal ? (
                formatCurrency(pendingTotal.amount)
              ) : (
                '-'
              )}
            </p>
          </div>
        </div>
      </div>
      {balanceQuery.isError && (
        <p className="mt-2 text-xs text-slate-500">
          Live balance unavailable (Stripe may not be configured). Historical reconciliation below
          still works from the last sync.
        </p>
      )}

      {/* Filters */}
      <div className="mt-6 grid gap-4 rounded-2xl border border-white/10 bg-white/5 p-4 md:grid-cols-4">
        <div>
          <label className={labelClass}>From</label>
          <input
            type="date"
            value={from}
            onChange={(e) => { setFrom(e.target.value); setPage(1); }}
            className={inputClass}
          />
        </div>
        <div>
          <label className={labelClass}>To</label>
          <input
            type="date"
            value={to}
            onChange={(e) => { setTo(e.target.value); setPage(1); }}
            className={inputClass}
          />
        </div>
        <div>
          <label className={labelClass}>Status</label>
          <select
            value={status}
            onChange={(e) => { setStatus(e.target.value); setPage(1); }}
            className={inputClass}
          >
            {statusOptions.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>
        <div>
          <label className={labelClass}>Match status</label>
          <select
            value={matchStatus}
            onChange={(e) => { setMatchStatus(e.target.value as '' | PayoutMatchStatus); setPage(1); }}
            className={inputClass}
          >
            {matchStatusOptions.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
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
          Sync now
        </button>
        <button
          type="button"
          onClick={exportToExcel}
          disabled={allRows.length === 0}
          className="btn-secondary inline-flex items-center gap-2"
        >
          <FileSpreadsheet className="h-4 w-4" />
          Export Excel
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
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          <div className="glass-card p-4">
            <p className="text-xs text-slate-500">Gross</p>
            <p className="mt-1 text-lg font-semibold">{formatCurrency(agg.gross)}</p>
          </div>
          <div className="glass-card p-4">
            <p className="text-xs text-slate-500">Fees</p>
            <p className="mt-1 text-lg font-semibold">{formatCurrency(agg.fees)}</p>
          </div>
          <div className="glass-card p-4">
            <p className="text-xs text-slate-500">Net payouts</p>
            <p className="mt-1 text-lg font-semibold">{formatCurrency(agg.net)}</p>
          </div>
          <div className="glass-card p-4">
            <p className="text-xs text-slate-500">Expected ledger net</p>
            <p className="mt-1 text-lg font-semibold">{formatCurrency(agg.expectedLedgerNet)}</p>
          </div>
          <div className="glass-card p-4">
            <p className="text-xs text-slate-500">Variance</p>
            <p
              className={`mt-1 text-lg font-semibold ${
                Math.abs(agg.variance) > 0.005 ? 'text-red-500' : 'text-green-500'
              }`}
            >
              {formatCurrency(agg.variance)}
            </p>
          </div>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="mt-6 flex items-center gap-2 rounded-xl border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-600 dark:text-red-400">
          <AlertCircle className="h-4 w-4" />
          Could not load the payout reconciliation report.
        </div>
      )}

      {/* Table */}
      <div className="mt-6 overflow-x-auto rounded-2xl border border-white/10 bg-white/5">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-900/50 text-xs uppercase text-slate-400">
            <tr>
              <th className="w-8 px-2 py-3" />
              {columns.map((col) => (
                <th key={col.key} className="whitespace-nowrap px-4 py-3 font-medium">
                  {col.label}
                </th>
              ))}
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
                  No payouts match the selected filters. Click &quot;Sync now&quot; to pull the latest
                  payouts from Stripe.
                </td>
              </tr>
            )}
            {allRows.map((row) => (
              <Fragment key={row.payoutId}>
                <tr
                  onClick={() => togglePayout(row.payoutId)}
                  className="cursor-pointer hover:bg-white/[0.02]"
                >
                  <td className="px-2 py-3">
                    {expandedPayout === row.payoutId ? (
                      <ChevronDown className="h-4 w-4 text-slate-500" />
                    ) : (
                      <ChevronRight className="h-4 w-4 text-slate-500" />
                    )}
                  </td>
                  {columns.map((col) => {
                    let value: React.ReactNode = row[col.key] as React.ReactNode;
                    if (['gross', 'fees', 'net', 'expectedLedgerNet'].includes(col.key)) {
                      value = formatCurrency(row[col.key] as number);
                    } else if (col.key === 'arrivalDate') {
                      value = formatDate(row.arrivalDate);
                    } else if (col.key === 'status') {
                      value = (
                        <span
                          className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                            row.status === 'paid'
                              ? 'bg-green-500/10 text-green-400'
                              : row.status === 'failed' || row.status === 'canceled'
                                ? 'bg-red-500/10 text-red-400'
                                : 'bg-slate-500/10 text-slate-400'
                          }`}
                        >
                          {row.status}
                        </span>
                      );
                    } else if (col.key === 'variance') {
                      value = (
                        <span
                          className={
                            Math.abs(row.variance) > 0.005
                              ? 'font-medium text-red-500'
                              : 'text-green-500'
                          }
                        >
                          {formatCurrency(row.variance)}
                        </span>
                      );
                    }
                    return (
                      <td key={col.key} className="max-w-[200px] truncate px-4 py-3">
                        {value ?? '-'}
                      </td>
                    );
                  })}
                </tr>
                {expandedPayout === row.payoutId && (
                  <tr>
                    <td colSpan={columns.length + 1} className="bg-slate-900/30 px-6 py-4">
                      {detailQuery.isLoading && (
                        <div className="flex justify-center py-6">
                          <Loader2 className="h-6 w-6 animate-spin text-neon-blue" />
                        </div>
                      )}
                      {detailQuery.isError && (
                        <p className="py-4 text-sm text-red-400">Could not load payout detail.</p>
                      )}
                      {detailQuery.data && (
                        <div className="overflow-x-auto">
                          <table className="w-full text-left text-xs">
                            <thead className="text-slate-500">
                              <tr>
                                <th className="py-2 pr-4 font-medium">Transaction</th>
                                <th className="py-2 pr-4 font-medium">Type</th>
                                <th className="py-2 pr-4 font-medium">Amount</th>
                                <th className="py-2 pr-4 font-medium">Fee</th>
                                <th className="py-2 pr-4 font-medium">Net</th>
                                <th className="py-2 pr-4 font-medium">Ledger receipt</th>
                                <th className="py-2 pr-4 font-medium">Ledger source</th>
                                <th className="py-2 pr-4 font-medium">Payer</th>
                                <th className="py-2 pr-4 font-medium">Ledger net</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-white/5">
                              {detailQuery.data.transactions.map((txn) => (
                                <tr key={txn.transactionId}>
                                  <td className="py-2 pr-4 font-mono">{txn.transactionId}</td>
                                  <td className="py-2 pr-4">{txn.type}</td>
                                  <td className="py-2 pr-4">{formatCurrency(txn.amount)}</td>
                                  <td className="py-2 pr-4">{formatCurrency(txn.fee)}</td>
                                  <td className="py-2 pr-4">{formatCurrency(txn.net)}</td>
                                  {txn.matchedPayment ? (
                                    <>
                                      <td className="py-2 pr-4">
                                        {txn.matchedPayment.receiptNumber ?? '-'}
                                      </td>
                                      <td className="py-2 pr-4">{txn.matchedPayment.sourceType}</td>
                                      <td className="py-2 pr-4">
                                        {txn.matchedPayment.payerName ?? '-'}
                                      </td>
                                      <td className="py-2 pr-4">
                                        {formatCurrency(txn.matchedPayment.netAmount)}
                                      </td>
                                    </>
                                  ) : (
                                    <td colSpan={4} className="py-2 pr-4 text-amber-400">
                                      No ledger match
                                    </td>
                                  )}
                                </tr>
                              ))}
                              {detailQuery.data.transactions.length === 0 && (
                                <tr>
                                  <td colSpan={9} className="py-4 text-center text-slate-500">
                                    No balance transactions stored for this payout yet.
                                  </td>
                                </tr>
                              )}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </td>
                  </tr>
                )}
              </Fragment>
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
    </div>
  );
}
