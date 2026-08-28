'use client';

import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useMutation } from '@tanstack/react-query';
import { CheckCircle, XCircle, Megaphone } from 'lucide-react';
import { api } from '@/lib/api';
import { usePhotoLightbox } from '@/components/ui/PhotoLightbox';
import { ProgressStats } from '@/components/fundraising/ProgressStats';
import { DonationForm } from '@/components/fundraising/DonationForm';
import { DonationList } from '@/components/fundraising/DonationList';
import { ShareButtons } from '@/components/ui/ShareButtons';
import { RichTextContent } from '@/components/ui/RichTextContent';
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
  startDate: string;
  endDate: string;
  category: string;
  status: string;
  createdAt: string;
  organizer?: { id: string; name: string; firstName?: string | null; lastName?: string | null } | null;
  updates?: { id: string; title: string; content: string; createdAt: string }[];
  photos?: { id: string; url: string; sortOrder: number }[];
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

  const confirmDonation = useMutation({
    mutationFn: async ({ sessionId, provider }: { sessionId: string; provider: string }) => {
      const res = await api.post('/payments/confirm-session', { sessionId, provider });
      return res.data;
    }
  });

  useEffect(() => {
    const sessionId = searchParams?.get('session_id');
    const provider = searchParams?.get('provider') ?? 'stripe';
    if (success && sessionId && !confirmDonation.isPending) {
      confirmDonation.mutate({ sessionId, provider });
    }
  }, [searchParams, success, confirmDonation]);

  const sortedPhotos = useMemo(
    () => (fundraiser.photos ? [...fundraiser.photos].sort((a, b) => a.sortOrder - b.sortOrder) : []),
    [fundraiser.photos]
  );
  const { open, Lightbox } = usePhotoLightbox(sortedPhotos);

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
                className="mb-6 h-72 w-full rounded-2xl object-contain shadow"
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

            {fundraiser.description && (
              <div className="mt-8">
                <h2 className="mb-3 text-lg font-semibold">{t('fullStory')}</h2>
                <RichTextContent
                  html={fundraiser.description}
                  className="text-slate-700 dark:text-slate-300"
                />
              </div>
            )}

            {sortedPhotos.length > 0 && (
              <div className="mt-8">
                <h2 className="mb-3 text-lg font-semibold">{t('gallery')}</h2>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                  {sortedPhotos.map((photo, index) => (
                    <button
                      key={photo.id}
                      type="button"
                      onClick={() => open(index)}
                      className="group relative aspect-square overflow-hidden rounded-xl border border-slate-100 text-left dark:border-slate-700"
                    >
                      <img
                        src={photo.url}
                        alt=""
                        className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                      />
                    </button>
                  ))}
                </div>
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
      <Lightbox />
    </div>
  );
}

