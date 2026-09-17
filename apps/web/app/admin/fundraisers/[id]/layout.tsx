'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import {
  ArrowLeft,
  Calendar,
  HeartHandshake,
  Info,
  Banknote,
  Megaphone,
  ShieldAlert,
  Image,
  Loader2
} from 'lucide-react';
import { api, getApiErrorMessage } from '@/lib/api';
import { AdminDetailTabs } from '@/components/admin/AdminDetailTabs';
import { formatDate } from '@/lib/utils';
import type { AdminFundraiser } from '../types';
import { FUNDRAISER_CATEGORIES, FUNDRAISER_STATUS_COLORS } from '../types';

const tabs = [
  { href: 'overview', label: 'Overview', icon: Info },
  { href: 'photos', label: 'Photos', icon: Image },
  { href: 'donations', label: 'Donations', icon: Banknote },
  { href: 'updates', label: 'Updates', icon: Megaphone },
  { href: 'moderation', label: 'Moderation', icon: ShieldAlert }
];

interface FundraiserDetailLayoutProps {
  children: React.ReactNode;
}

export default function FundraiserDetailLayout({ children }: FundraiserDetailLayoutProps) {
  const { id } = useParams<{ id: string }>();

  const {
    data: fundraiser,
    isLoading,
    error
  } = useQuery<AdminFundraiser>({
    queryKey: ['admin', 'fundraisers', id],
    queryFn: async () => {
      const res = await api.get(`/fundraisers/${id}`);
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

  if (error || !fundraiser) {
    return (
      <div className="glass-card p-8 text-center">
        <h2 className="text-xl font-semibold text-red-400">Could not load fundraiser</h2>
        <p className="mt-2 text-slate-500">
          {error ? getApiErrorMessage(error) : 'Fundraiser not found.'}
        </p>
        <Link
          href="/admin/fundraisers"
          className="mt-6 inline-flex items-center gap-2 text-sm font-medium text-neon-blue hover:underline"
        >
          <ArrowLeft className="h-4 w-4" /> Back to fundraisers
        </Link>
      </div>
    );
  }

  const hasEnded = new Date(fundraiser.endDate) < new Date();

  return (
    <div>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <Link
            href="/admin/fundraisers"
            className="mt-1 rounded-lg p-2 text-slate-500 hover:bg-white/5 hover:text-slate-300"
          >
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div>
            <h1 className="section-title">{fundraiser.title}</h1>
            <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-slate-500">
              <HeartHandshake className="h-3.5 w-3.5" />
              <span>{FUNDRAISER_CATEGORIES.find((c) => c.value === fundraiser.category)?.label ?? fundraiser.category}</span>
              <span>·</span>
              <Calendar className="h-3.5 w-3.5" />
              <span>{formatDate(fundraiser.startDate)}</span>
              <span>–</span>
              <span>{formatDate(fundraiser.endDate)}</span>
              {hasEnded && (
                <span className="rounded-full bg-amber-500/10 px-2 py-0.5 text-xs font-semibold text-amber-400">
                  Ended
                </span>
              )}
              <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${FUNDRAISER_STATUS_COLORS[fundraiser.status] ?? FUNDRAISER_STATUS_COLORS.COMPLETED}`}>
                {fundraiser.status.replace('_', ' ')}
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="mt-4">
        <AdminDetailTabs tabs={tabs} basePath={`/admin/fundraisers/${id}`} />
      </div>

      {children}
    </div>
  );
}
