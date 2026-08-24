'use client';

import { useParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { Loader2, Receipt, CreditCard, Ticket, Heart, Store, Briefcase, UserCheck } from 'lucide-react';
import { api } from '@/lib/api';
import { formatDate, formatCurrency } from '@/lib/utils';
import type { TransactionItem } from '../../types';

const sourceTypeIcons: Record<string, React.ReactNode> = {
  TICKET: <Ticket className="h-4 w-4" />,
  MEMBERSHIP: <UserCheck className="h-4 w-4" />,
  DONATION: <Heart className="h-4 w-4" />,
  DIRECTORY_PROMOTION: <Store className="h-4 w-4" />,
  JOB_PUBLISH: <Briefcase className="h-4 w-4" />,
  MANUAL: <CreditCard className="h-4 w-4" />
};

function getSourceLabel(sourceType: string, related: TransactionItem['related']) {
  switch (sourceType) {
    case 'TICKET':
      return related.event ? `Ticket: ${related.event.title}` : 'Ticket';
    case 'MEMBERSHIP':
      return 'Membership';
    case 'DONATION':
      return related.donation ? `Donation: ${related.donation.fundraiser.title}` : 'Donation';
    case 'DIRECTORY_PROMOTION':
      return related.businessListing
        ? `Directory promotion: ${related.businessListing.businessName}`
        : 'Directory promotion';
    case 'JOB_PUBLISH':
      return related.jobAd ? `Job ad: ${related.jobAd.title}` : 'Job ad';
    default:
      return sourceType.replace(/_/g, ' ').toLowerCase();
  }
}

function getStatusClass(status: string) {
  switch (status) {
    case 'COMPLETED':
      return 'bg-green-500/10 text-green-400';
    case 'REFUNDED':
    case 'PARTIALLY_REFUNDED':
      return 'bg-amber-500/10 text-amber-400';
    case 'FAILED':
      return 'bg-red-500/10 text-red-400';
    default:
      return 'bg-slate-500/10 text-slate-400';
  }
}

export default function UserTransactionsPage() {
  const { id } = useParams<{ id: string }>();

  const { data: transactions, isLoading } = useQuery<TransactionItem[]>({
    queryKey: ['admin', 'users', id, 'transactions'],
    queryFn: async () => {
      const res = await api.get(`/admin/users/${id}/transactions`);
      return res.data;
    },
    enabled: !!id
  });

  if (isLoading || !transactions) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-neon-blue" />
      </div>
    );
  }

  return (
    <div className="max-w-5xl">
      <section className="glass-card p-5">
        <h3 className="mb-4 flex items-center gap-2 text-lg font-semibold">
          <Receipt className="h-5 w-5 text-neon-blue" /> Transaction History
        </h3>
        {transactions.length === 0 ? (
          <p className="text-sm text-slate-500">No transactions found.</p>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-white/10 bg-white/5">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-900/50 text-xs uppercase text-slate-400">
                <tr>
                  <th className="whitespace-nowrap px-4 py-3 font-medium">Date</th>
                  <th className="whitespace-nowrap px-4 py-3 font-medium">Receipt #</th>
                  <th className="whitespace-nowrap px-4 py-3 font-medium">Source</th>
                  <th className="whitespace-nowrap px-4 py-3 font-medium">Description</th>
                  <th className="whitespace-nowrap px-4 py-3 font-medium">Channel</th>
                  <th className="whitespace-nowrap px-4 py-3 font-medium">Amount</th>
                  <th className="whitespace-nowrap px-4 py-3 font-medium">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {transactions.map((t) => (
                  <tr key={t.id} className="hover:bg-white/[0.02]">
                    <td className="whitespace-nowrap px-4 py-3 text-slate-400">
                      {formatDate(t.date)}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 font-mono text-xs">
                      {t.receiptNumber ?? '-'}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3">
                      <div className="flex items-center gap-2">
                        {sourceTypeIcons[t.sourceType] ?? <CreditCard className="h-4 w-4" />}
                        <span className="capitalize">{getSourceLabel(t.sourceType, t.related)}</span>
                      </div>
                    </td>
                    <td className="max-w-[200px] truncate px-4 py-3 text-slate-400">
                      {t.description ?? '-'}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 capitalize text-slate-400">
                      {t.paymentChannel}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3">
                      <div className="flex flex-col">
                        <span className="font-medium">{formatCurrency(t.grossAmount)}</span>
                        {t.refundedAmount ? (
                          <span className="text-xs text-amber-400">
                            Refunded: {formatCurrency(t.refundedAmount)}
                          </span>
                        ) : null}
                      </div>
                    </td>
                    <td className="whitespace-nowrap px-4 py-3">
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs font-medium ${getStatusClass(
                          t.paymentStatus
                        )}`}
                      >
                        {t.paymentStatus.replace(/_/g, ' ')}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
