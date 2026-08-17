'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, CreditCard, Info, Loader2, User } from 'lucide-react';
import { api, getApiErrorMessage } from '@/lib/api';
import { AdminDetailTabs } from '@/components/admin/AdminDetailTabs';
import type { AdminMembership } from '../types';

const tabs = [
  { href: 'details', label: 'Details', icon: Info },
  { href: 'card', label: 'Card', icon: CreditCard }
];

interface MembershipDetailLayoutProps {
  children: React.ReactNode;
}

export default function MembershipDetailLayout({ children }: MembershipDetailLayoutProps) {
  const { id } = useParams<{ id: string }>();

  const {
    data: membership,
    isLoading,
    error
  } = useQuery<AdminMembership>({
    queryKey: ['admin', 'memberships', id],
    queryFn: async () => {
      const res = await api.get(`/admin/memberships/${id}`);
      return res.data;
    },
    enabled: !!id
  });

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-neon-blue" />
      </div>
    );
  }

  if (error || !membership) {
    return (
      <div className="glass-card p-8 text-center">
        <h2 className="text-xl font-semibold text-red-400">Could not load membership</h2>
        <p className="mt-2 text-slate-500">
          {error ? getApiErrorMessage(error) : 'Membership not found.'}
        </p>
        <Link
          href="/admin/memberships"
          className="mt-6 inline-flex items-center gap-2 text-sm font-medium text-neon-blue hover:underline"
        >
          <ArrowLeft className="h-4 w-4" /> Back to memberships
        </Link>
      </div>
    );
  }

  const isExpired = membership.endDate ? new Date(membership.endDate) < new Date() : false;

  return (
    <div>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <Link
            href="/admin/memberships"
            className="mt-1 rounded-lg p-2 text-slate-500 hover:bg-white/5 hover:text-slate-300"
          >
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div>
            <h1 className="section-title">{membership.user.name}</h1>
            <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-slate-500">
              <User className="h-3.5 w-3.5" />
              <span>{membership.user.email}</span>
              <span>·</span>
              <CreditCard className="h-3.5 w-3.5" />
              <span>{membership.membershipType.name}</span>
              <span
                className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                  membership.status === 'ACTIVE'
                    ? 'bg-green-500/10 text-green-400'
                    : membership.status === 'PENDING'
                      ? 'bg-yellow-500/10 text-yellow-400'
                      : 'bg-red-500/10 text-red-400'
                }`}
              >
                {membership.status}
              </span>
              {isExpired && (
                <span className="rounded-full bg-amber-500/10 px-2 py-0.5 text-xs font-semibold text-amber-400">
                  Expired
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="mt-4">
        <AdminDetailTabs tabs={tabs} basePath={`/admin/memberships/${id}`} />
      </div>

      {children}
    </div>
  );
}
