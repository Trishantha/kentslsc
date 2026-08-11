'use client';

import { useEffect, useState } from 'react';
import { Link } from '@/i18n/routing';
import { Loader2, Plus, Clock, CheckCircle2, XCircle, Megaphone } from 'lucide-react';
import { api } from '@/lib/api';
import { useAuth } from '@/hooks/useAuth';

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  PENDING_APPROVAL: {
    label: 'Pending Review',
    color: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
    icon: <Clock className="h-3.5 w-3.5" />
  },
  ACTIVE: {
    label: 'Active',
    color: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300',
    icon: <CheckCircle2 className="h-3.5 w-3.5" />
  },
  REJECTED: {
    label: 'Rejected',
    color: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300',
    icon: <XCircle className="h-3.5 w-3.5" />
  },
  COMPLETED: {
    label: 'Completed',
    color: 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-400',
    icon: <Megaphone className="h-3.5 w-3.5" />
  }
};

interface Campaign {
  id: string;
  title: string;
  raisedAmount: number;
  targetAmount: number;
  totalDonors: number;
  status: string;
  category: string;
  imageUrl?: string | null;
  rejectionReason?: string | null;
  endDate: string;
}

export default function MyCampaignsPage() {
  const { user, loading: authLoading } = useAuth();
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    api
      .get('/fundraisers/my')
      .then((res) => setCampaigns(res.data))
      .finally(() => setLoading(false));
  }, [user]);

  if (authLoading || loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-neon-blue" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Link href="/auth/login" className="btn-primary">Log in to view your campaigns</Link>
      </div>
    );
  }

  return (
    <div className="px-4 py-16 md:px-6">
      <div className="mx-auto max-w-4xl">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="section-title">My Campaigns</h1>
            <p className="mt-2 text-slate-500 dark:text-slate-400">{campaigns.length} campaign{campaigns.length !== 1 ? 's' : ''}</p>
          </div>
          <Link href="/fundraisers/create" className="btn-primary flex items-center gap-2">
            <Plus className="h-4 w-4" /> New campaign
          </Link>
        </div>

        {campaigns.length === 0 ? (
          <div className="mt-20 text-center">
            <p className="text-slate-400">You haven&apos;t started any campaigns yet.</p>
            <Link href="/fundraisers/create" className="btn-primary mt-4 inline-flex">
              Start your first campaign
            </Link>
          </div>
        ) : (
          <div className="mt-8 space-y-4">
            {campaigns.map((c) => {
              const progress = c.targetAmount > 0 ? Math.min((c.raisedAmount / c.targetAmount) * 100, 100) : 0;
              const statusConfig =
                c.status === 'PENDING_APPROVAL'
                  ? { label: 'Pending Review', color: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300', icon: <Clock className="h-3.5 w-3.5" /> }
                  : c.status === 'ACTIVE'
                    ? { label: 'Active', color: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300', icon: <CheckCircle2 className="h-3.5 w-3.5" /> }
                    : c.status === 'REJECTED'
                      ? { label: 'Rejected', color: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300', icon: <XCircle className="h-3.5 w-3.5" /> }
                      : { label: 'Completed', color: 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-400', icon: <Megaphone className="h-3.5 w-3.5" /> };
              const resolvedStatusConfig = statusConfig;
              return (
                <div key={c.id} className="glass-card flex gap-4 p-5">
                  {c.imageUrl ? (
                    <img src={c.imageUrl} alt={c.title} className="h-20 w-28 shrink-0 rounded-xl object-cover" />
                  ) : (
                    <div className="h-20 w-28 shrink-0 rounded-xl bg-gradient-to-br from-neon-blue/20 to-neon-gold/20" />
                  )}

                  <div className="flex-1">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <h3 className="font-semibold text-slate-800 dark:text-slate-200">{c.title}</h3>
                      <span className={`flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium ${resolvedStatusConfig.color}`}>
                        {resolvedStatusConfig.icon} {resolvedStatusConfig.label}
                      </span>
                    </div>

                    {c.status === 'REJECTED' && c.rejectionReason && (
                      <p className="mt-1 text-xs text-red-500">Reason: {c.rejectionReason}</p>
                    )}

                    <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-neon-blue to-neon-gold"
                        style={{ width: `${progress}%` }}
                      />
                    </div>
                    <p className="mt-1 text-xs text-slate-500">
                      £{c.raisedAmount.toLocaleString()} raised of £{c.targetAmount.toLocaleString()} · {c.totalDonors} donors
                    </p>
                  </div>

                  {c.status === 'ACTIVE' && (
                    <div className="flex shrink-0 flex-col gap-2">
                      <Link href={`/fundraisers/${c.id}`} className="btn-secondary px-4 py-1.5 text-xs">
                        View
                      </Link>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
