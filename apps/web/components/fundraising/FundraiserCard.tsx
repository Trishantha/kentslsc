'use client';

import { Heart, Users, Calendar } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/routing';

const CATEGORY_LABELS: Record<string, string> = {
  CHARITY: 'Charity',
  SPORTS: 'Sports',
  COMMUNITY: 'Community',
  MEMORIAL: 'Memorial',
  MEDICAL: 'Medical',
  OTHER: 'Other'
};

const CATEGORY_COLORS: Record<string, string> = {
  CHARITY: 'bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300',
  SPORTS: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',
  COMMUNITY: 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300',
  MEMORIAL: 'bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300',
  MEDICAL: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
  OTHER: 'bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-300'
};

export interface FundraiserCardData {
  id: string;
  title: string;
  description?: string | null;
  targetAmount: number;
  raisedAmount: number;
  totalDonors: number;
  imageUrl?: string | null;
  aiSummary?: string | null;
  endDate: string;
  category: string;
  organizer?: { name: string } | null;
}

interface Props {
  fundraiser: FundraiserCardData;
}

export function FundraiserCard({ fundraiser: f }: Props) {
  const t = useTranslations('fundraisers');
  const progress = f.targetAmount > 0 ? Math.min((f.raisedAmount / f.targetAmount) * 100, 100) : 0;
  const daysLeft = Math.max(0, Math.ceil((new Date(f.endDate).getTime() - Date.now()) / 86_400_000));

  return (
    <div className="glass-card flex flex-col overflow-hidden p-0">
      <div className="relative">
        {f.imageUrl ? (
          <img src={f.imageUrl} alt={f.title} className="h-44 w-full object-cover" />
        ) : (
          <div className="h-44 w-full bg-gradient-to-br from-neon-blue/30 to-neon-gold/30" />
        )}
        <span className={`absolute left-3 top-3 rounded-full px-2 py-0.5 text-xs font-semibold ${CATEGORY_COLORS[f.category] ?? CATEGORY_COLORS.OTHER}`}>
          {CATEGORY_LABELS[f.category] ?? f.category}
        </span>
      </div>

      <div className="flex flex-1 flex-col p-5">
        <h3 className="line-clamp-2 text-lg font-bold leading-snug">{f.title}</h3>
        {f.organizer && (
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">by {f.organizer.name}</p>
        )}
        <p className="mt-2 line-clamp-2 flex-1 text-sm text-slate-600 dark:text-slate-400">
          {f.aiSummary ?? f.description ?? ''}
        </p>

        <div className="mt-4">
          <div className="h-2.5 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700">
            <div
              className="h-full rounded-full bg-gradient-to-r from-neon-blue to-neon-gold transition-all"
              style={{ width: `${progress}%` }}
            />
          </div>
          <div className="mt-1.5 flex justify-between text-xs text-slate-500 dark:text-slate-400">
            <span className="font-semibold text-slate-800 dark:text-slate-200">
              £{f.raisedAmount.toLocaleString()} raised
            </span>
            <span>of £{f.targetAmount.toLocaleString()}</span>
          </div>
        </div>

        <div className="mt-3 flex items-center gap-4 text-xs text-slate-500 dark:text-slate-400">
          <span className="flex items-center gap-1">
            <Users className="h-3.5 w-3.5" />
            {f.totalDonors} {f.totalDonors === 1 ? 'supporter' : 'supporters'}
          </span>
          <span className="flex items-center gap-1">
            <Calendar className="h-3.5 w-3.5" />
            {daysLeft === 0 ? 'Ends today' : `${daysLeft}d left`}
          </span>
        </div>

        <Link href={`/fundraisers/${f.id}`} className="btn-primary mt-4 flex items-center justify-center gap-2 py-2 text-sm">
          <Heart className="h-4 w-4" />
          {t('donate')}
        </Link>
      </div>
    </div>
  );
}
