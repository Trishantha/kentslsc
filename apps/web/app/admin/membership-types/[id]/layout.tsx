'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, Ticket, Info, Banknote, Sparkles, Loader2 } from 'lucide-react';
import { api, getApiErrorMessage } from '@/lib/api';
import { AdminDetailTabs } from '@/components/admin/AdminDetailTabs';
import type { AdminMembershipType } from '../types';

const tabs = [
  { href: 'details', label: 'Details', icon: Info },
  { href: 'pricing', label: 'Pricing', icon: Banknote },
  { href: 'features', label: 'Features', icon: Sparkles }
];

interface MembershipTypeDetailLayoutProps {
  children: React.ReactNode;
}

export default function MembershipTypeDetailLayout({ children }: MembershipTypeDetailLayoutProps) {
  const { id } = useParams<{ id: string }>();

  const {
    data: membershipType,
    isLoading,
    error
  } = useQuery<AdminMembershipType>({
    queryKey: ['admin', 'membership-types', id],
    queryFn: async () => {
      const res = await api.get<AdminMembershipType[]>('/membership/types');
      const type = res.data.find((t) => t.id === id);
      if (!type) throw new Error('Membership type not found.');
      return type;
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

  if (error || !membershipType) {
    return (
      <div className="glass-card p-8 text-center">
        <h2 className="text-xl font-semibold text-red-400">Could not load membership type</h2>
        <p className="mt-2 text-slate-500">
          {error ? getApiErrorMessage(error) : 'Membership type not found.'}
        </p>
        <Link
          href="/admin/membership-types"
          className="mt-6 inline-flex items-center gap-2 text-sm font-medium text-neon-blue hover:underline"
        >
          <ArrowLeft className="h-4 w-4" /> Back to membership types
        </Link>
      </div>
    );
  }

  return (
    <div>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <Link
            href="/admin/membership-types"
            className="mt-1 rounded-lg p-2 text-slate-500 hover:bg-white/5 hover:text-slate-300"
          >
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div>
            <h1 className="section-title">{membershipType.name}</h1>
            <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-slate-500">
              <Ticket className="h-3.5 w-3.5" />
              <span>{membershipType.isFree || membershipType.price === 0 ? 'Free' : `£${membershipType.price}`}</span>
              <span>·</span>
              <span>{membershipType.isFree ? 'Lifetime' : `${membershipType.durationMonths} months`}</span>
              {membershipType.autoActivate && (
                <span className="rounded-full bg-green-500/10 px-2 py-0.5 text-xs font-semibold text-green-400">
                  Auto-activate
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="mt-4">
        <AdminDetailTabs tabs={tabs} basePath={`/admin/membership-types/${id}`} />
      </div>

      {children}
    </div>
  );
}
