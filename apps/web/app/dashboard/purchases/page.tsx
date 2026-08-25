'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Loader2, CreditCard, Ticket, Heart, Building2, Briefcase } from 'lucide-react';
import Link from 'next/link';
import { api } from '@/lib/api';
import { formatCurrency } from '@/lib/utils';

interface Payment {
  id: string;
  date: string;
  paymentStatus: string;
  sourceType: string;
  currency: string;
  grossAmount: number;
  netAmount: number;
  refundedAmount: number | null;
  description: string | null;
  event?: { id: string; title: string; startDatetime: string; location: string | null } | null;
  membership?: { id: string; membershipId: string; membershipType: { name: string } } | null;
  donation?: { id: string; fundraiser: { title: string } } | null;
  businessListing?: { id: string; businessName: string } | null;
  jobAd?: { id: string; title: string } | null;
}

interface MyPaymentsResponse {
  data: Payment[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

const tabs = [
  { key: 'ALL', label: 'All', icon: CreditCard },
  { key: 'TICKET', label: 'Tickets', icon: Ticket },
  { key: 'MEMBERSHIP', label: 'Memberships', icon: CreditCard },
  { key: 'DONATION', label: 'Donations', icon: Heart },
  { key: 'DIRECTORY_PROMOTION', label: 'Promotions', icon: Building2 },
  { key: 'JOB_PUBLISH', label: 'Jobs', icon: Briefcase }
];

export default function PurchasesPage() {
  const [activeTab, setActiveTab] = useState('ALL');
  const { data, isLoading } = useQuery<MyPaymentsResponse>({
    queryKey: ['payments', 'my'],
    queryFn: async () => {
      const { data } = await api.get('/payments/my?page=1&limit=200');
      return data;
    }
  });

  const payments = data?.data ?? [];
  const filtered =
    activeTab === 'ALL' ? payments : payments.filter((p) => p.sourceType === activeTab);

  const getTitle = (payment: Payment) => {
    if (payment.event) return `Ticket: ${payment.event.title}`;
    if (payment.membership) return `Membership: ${payment.membership.membershipType.name}`;
    if (payment.donation) return `Donation: ${payment.donation.fundraiser.title}`;
    if (payment.businessListing) return `Directory promotion: ${payment.businessListing.businessName}`;
    if (payment.jobAd) return `Job publish: ${payment.jobAd.title}`;
    return payment.description ?? 'Payment';
  };

  const getHref = (payment: Payment) => {
    if (payment.event) return `/dashboard/tickets`;
    if (payment.membership) return `/dashboard`;
    if (payment.donation) return `/fundraisers`;
    if (payment.businessListing) return `/directory/${payment.businessListing.id}`;
    return '#';
  };

  return (
    <div className="px-4 py-12 md:px-6">
      <div className="mx-auto max-w-4xl">
        <h1 className="section-title">My Purchases</h1>
        <p className="mt-2 text-slate-600 dark:text-slate-400">
          View your tickets, memberships, donations, and directory payments.
        </p>

        <div className="mt-8 flex flex-wrap gap-2">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.key}
                type="button"
                onClick={() => setActiveTab(tab.key)}
                className={`inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-medium transition-colors ${
                  activeTab === tab.key
                    ? 'bg-neon-blue text-white'
                    : 'bg-white/5 text-slate-600 hover:bg-white/10 dark:text-slate-300'
                }`}
              >
                <Icon className="h-4 w-4" />
                {tab.label}
              </button>
            );
          })}
        </div>

        {isLoading && (
          <div className="mt-10 flex items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-neon-blue" />
          </div>
        )}

        <div className="mt-6 space-y-4">
          {!isLoading && filtered.length === 0 && (
            <div className="rounded-2xl bg-white/5 p-10 text-center">
              <p className="text-slate-600 dark:text-slate-400">No purchases found.</p>
            </div>
          )}
          {filtered.map((payment) => (
            <Link
              key={payment.id}
              href={getHref(payment)}
              className="block rounded-2xl border border-white/10 bg-white/5 p-5 transition-colors hover:bg-white/10"
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h3 className="font-semibold">{getTitle(payment)}</h3>
                  <p className="mt-1 text-xs text-slate-500">
                    {new Date(payment.date).toLocaleString()} · {payment.paymentStatus}
                  </p>
                </div>
                <div className="text-right">
                  <p className="font-semibold">{formatCurrency(payment.grossAmount / 100)}</p>
                  {payment.refundedAmount ? (
                    <p className="text-xs text-amber-400">
                      Refunded {formatCurrency(payment.refundedAmount / 100)}
                    </p>
                  ) : null}
                </div>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
