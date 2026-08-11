'use client';

import { Users, Target, Calendar, TrendingUp } from 'lucide-react';

interface Props {
  raisedAmount: number;
  targetAmount: number;
  totalDonors: number;
  endDate: string;
}

export function ProgressStats({ raisedAmount, targetAmount, totalDonors, endDate }: Props) {
  const progress = targetAmount > 0 ? Math.min((raisedAmount / targetAmount) * 100, 100) : 0;
  const daysLeft = Math.max(0, Math.ceil((new Date(endDate).getTime() - Date.now()) / 86_400_000));

  return (
    <div>
      <div className="mb-2 flex items-end justify-between">
        <span className="text-3xl font-bold text-slate-900 dark:text-slate-100">
          £{raisedAmount.toLocaleString()}
        </span>
        <span className="text-sm text-slate-500 dark:text-slate-400">
          {Math.round(progress)}% of £{targetAmount.toLocaleString()}
        </span>
      </div>

      <div className="h-4 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700">
        <div
          className="h-full rounded-full bg-gradient-to-r from-neon-blue to-neon-gold transition-all duration-700"
          style={{ width: `${progress}%` }}
        />
      </div>

      <div className="mt-4 grid grid-cols-3 divide-x divide-slate-200 dark:divide-slate-700">
        <div className="flex flex-col items-center gap-1 pr-4">
          <TrendingUp className="h-5 w-5 text-neon-blue" />
          <span className="text-xl font-bold">£{raisedAmount.toLocaleString()}</span>
          <span className="text-xs text-slate-500 dark:text-slate-400">raised</span>
        </div>
        <div className="flex flex-col items-center gap-1 px-4">
          <Users className="h-5 w-5 text-neon-gold" />
          <span className="text-xl font-bold">{totalDonors}</span>
          <span className="text-xs text-slate-500 dark:text-slate-400">supporters</span>
        </div>
        <div className="flex flex-col items-center gap-1 pl-4">
          <Calendar className="h-5 w-5 text-slate-500" />
          <span className="text-xl font-bold">{daysLeft}</span>
          <span className="text-xs text-slate-500 dark:text-slate-400">{daysLeft === 1 ? 'day left' : 'days left'}</span>
        </div>
      </div>
    </div>
  );
}
