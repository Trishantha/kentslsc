import Link from 'next/link';
import { ArrowLeft, Calendar, HeartHandshake } from 'lucide-react';
import { fetchWithOriginFallback } from '@/lib/server-api-fetch';
import { notFound } from 'next/navigation';
import { AdminDetailTabs } from '@/components/admin/AdminDetailTabs';
import { Info, Banknote, Megaphone, ShieldAlert } from 'lucide-react';
import type { AdminFundraiser } from '../types';
import { FUNDRAISER_CATEGORIES, FUNDRAISER_STATUS_COLORS } from '../types';

interface FundraiserDetailLayoutProps {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
}

async function getFundraiser(id: string): Promise<AdminFundraiser | null> {
  return fetchWithOriginFallback(`/api/fundraisers/${id}`);
}

const tabs = [
  { href: 'overview', label: 'Overview', icon: Info },
  { href: 'donations', label: 'Donations', icon: Banknote },
  { href: 'updates', label: 'Updates', icon: Megaphone },
  { href: 'moderation', label: 'Moderation', icon: ShieldAlert }
];

export default async function FundraiserDetailLayout({ children, params }: FundraiserDetailLayoutProps) {
  const { id } = await params;
  const fundraiser = await getFundraiser(id);
  if (!fundraiser) notFound();

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
              <span>{new Date(fundraiser.startDate).toLocaleDateString('en-GB')}</span>
              <span>–</span>
              <span>{new Date(fundraiser.endDate).toLocaleDateString('en-GB')}</span>
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
