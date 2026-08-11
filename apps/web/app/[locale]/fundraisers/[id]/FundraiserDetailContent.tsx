'use client';

import { useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { CheckCircle, XCircle, Megaphone } from 'lucide-react';
import { ProgressStats } from '@/components/fundraising/ProgressStats';
import { DonationForm } from '@/components/fundraising/DonationForm';
import { DonationList } from '@/components/fundraising/DonationList';
import { ShareButtons } from '@/components/fundraising/ShareButtons';
import { FundraiserUpdates } from '@/components/fundraising/FundraiserUpdates';

const CATEGORY_LABELS: Record<string, string> = {
  CHARITY: 'Charity', SPORTS: 'Sports', COMMUNITY: 'Community',
  MEMORIAL: 'Memorial', MEDICAL: 'Medical', OTHER: 'Other'
};

export interface Fundraiser {
  id: string;
  title: string;
  description?: string | null;
  targetAmount: number;
  raisedAmount: number;
  totalDonors: number;
  imageUrl?: string | null;
  aiSummary?: string | null;
  startDate: string;
  endDate: string;
  category: string;
  status: string;
  createdAt: string;
  organizer?: { id: string; name: string; firstName?: string | null; lastName?: string | null } | null;
  updates?: { id: string; title: string; content: string; createdAt: string }[];
}

interface Props {
  fundraiser: Fundraiser;
  shareUrl: string;
}

export default function FundraiserDetailContent({ fundraiser, shareUrl }: Props) {
  const searchParams = useSearchParams();
  const t = useTranslations('fundraiserDetail');
  const [activeTab, setActiveTab] = useState<'updates' | 'donations'>('donations');
  const success = searchParams?.get('success');
  const canceled = searchParams?.get('canceled');

  return (
    <div className="px-4 py-12 md:px-6">
      <div className="mx-auto max-w-5xl">
        {success && (
          <div className="mb-6 flex items-center gap-3 rounded-xl bg-green-50 p-4 text-green-800 dark:bg-green-900/30 dark:text-green-200">
            <CheckCircle className="h-5 w-5 shrink-0" />
            {t('thankYou')}
          </div>
        )}
        {canceled && (
          <div className="mb-6 flex items-center gap-3 rounded-xl bg-amber-50 p-4 text-amber-800 dark:bg-amber-900/30 dark:text-amber-200">
            <XCircle className="h-5 w-5 shrink-0" />
            {t('canceled')}
          </div>
        )}

        <div className="grid gap-8 lg:grid-cols-3">
          {/* Left: campaign content */}
          <div className="lg:col-span-2">
            {fundraiser.imageUrl ? (
              <img
                src={fundraiser.imageUrl}
                alt={fundraiser.title}
                className="mb-6 h-72 w-full rounded-2xl object-cover shadow"
              />
            ) : (
              <div className="mb-6 h-72 w-full rounded-2xl bg-gradient-to-br from-neon-blue/30 to-neon-gold/30" />
            )}

            <div className="mb-1 flex items-center gap-2">
              <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600 dark:bg-slate-700 dark:text-slate-300">
                {CATEGORY_LABELS[fundraiser.category] ?? fundraiser.category}
              </span>
            </div>

            <h1 className="mt-2 text-3xl font-bold">{fundraiser.title}</h1>

            {fundraiser.organizer && (
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                Campaign by <span className="font-medium">{fundraiser.organizer.firstName ?? fundraiser.organizer.name}</span>
              </p>
            )}

            {(fundraiser.aiSummary ?? fundraiser.description) && (
              <div className="mt-4 rounded-xl border border-slate-100 bg-slate-50 p-5 dark:border-slate-700 dark:bg-slate-800/50">
                <p className="text-slate-700 dark:text-slate-300 leading-relaxed">
                  {fundraiser.aiSummary ?? fundraiser.description}
                </p>
              </div>
            )}

            {/* Tabs */}
            <div className="mt-8">
              <div className="mb-4 flex gap-2 border-b border-slate-200 dark:border-slate-700">
                {(['donations', 'updates'] as const).map((tab) => (
                  <button
                    key={tab}
                    onClick={() => setActiveTab(tab)}
                    className={`flex items-center gap-1.5 border-b-2 px-4 pb-3 text-sm font-medium transition-colors ${
                      activeTab === tab
                        ? 'border-neon-blue text-neon-blue'
                        : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                    }`}
                  >
                    {tab === 'updates' && <Megaphone className="h-3.5 w-3.5" />}
                    {tab === 'donations' ? `Supporters (${fundraiser.totalDonors})` : 'Updates'}
                  </button>
                ))}
              </div>

              {activeTab === 'donations' ? (
                <DonationList fundraiserId={fundraiser.id} />
              ) : (
                <FundraiserUpdates fundraiserId={fundraiser.id} />
              )}
            </div>
          </div>

          {/* Right: sticky sidebar */}
          <div className="space-y-6">
            <div className="glass-card p-6">
              <ProgressStats
                raisedAmount={fundraiser.raisedAmount}
                targetAmount={fundraiser.targetAmount}
                totalDonors={fundraiser.totalDonors}
                endDate={fundraiser.endDate}
              />
            </div>

            <div className="glass-card p-6">
              <h2 className="mb-4 text-lg font-bold">{t('makeDonation')}</h2>
              <DonationForm fundraiserId={fundraiser.id} />
            </div>

            <div className="glass-card p-6">
              <ShareButtons url={shareUrl} title={fundraiser.title} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

