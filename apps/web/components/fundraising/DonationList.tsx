'use client';

import { useState, useEffect } from 'react';
import { Loader2, Trophy, Clock, WifiOff } from 'lucide-react';
import { api } from '@/lib/api';

interface Donation {
  id: string;
  amount: number;
  displayName: string;
  message?: string | null;
  isAnonymous: boolean;
  isOffline: boolean;
  donatedAt: string;
}

interface Props {
  fundraiserId: string;
}

export function DonationList({ fundraiserId }: Props) {
  const [tab, setTab] = useState<'recent' | 'top'>('recent');
  const [donations, setDonations] = useState<Donation[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    setPage(1);
    api
      .get(`/fundraisers/${fundraiserId}/donations`, { params: { sort: tab, page: 1, limit: 10 } })
      .then((res) => {
        setDonations(res.data.items);
        setTotal(res.data.total);
      })
      .finally(() => setLoading(false));
  }, [fundraiserId, tab]);

  const loadMore = async () => {
    const nextPage = page + 1;
    const res = await api.get(`/fundraisers/${fundraiserId}/donations`, {
      params: { sort: tab, page: nextPage, limit: 10 }
    });
    setDonations((prev) => [...prev, ...res.data.items]);
    setPage(nextPage);
  };

  const timeAgo = (dateStr: string) => {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'just now';
    if (mins < 60) return `${mins}m ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    return `${Math.floor(hours / 24)}d ago`;
  };

  return (
    <div>
      <div className="mb-4 flex gap-2">
        {(['recent', 'top'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`flex items-center gap-1.5 rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
              tab === t
                ? 'bg-neon-blue text-white'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-700 dark:text-slate-300'
            }`}
          >
            {t === 'recent' ? <Clock className="h-3.5 w-3.5" /> : <Trophy className="h-3.5 w-3.5" />}
            {t === 'recent' ? 'Recent' : 'Top donors'}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-neon-blue" />
        </div>
      ) : donations.length === 0 ? (
        <p className="py-8 text-center text-slate-400">No donations yet — be the first!</p>
      ) : (
        <ul className="space-y-3">
          {donations.map((d) => (
            <li key={d.id} className="flex items-start gap-3 rounded-xl border border-slate-100 bg-white p-4 dark:border-slate-700 dark:bg-slate-800/50">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-neon-blue/30 to-neon-gold/30 text-sm font-bold text-slate-700 dark:text-slate-200">
                {d.displayName.charAt(0).toUpperCase()}
              </div>
              <div className="flex-1">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-semibold text-slate-800 dark:text-slate-200">
                    {d.displayName}
                  </span>
                  <span className="text-xs text-slate-400">{timeAgo(d.donatedAt)}</span>
                </div>
                <div className="mt-0.5 flex items-center gap-2">
                  <span className="text-sm font-bold text-neon-blue">£{d.amount.toFixed(2)}</span>
                  {d.isOffline && (
                    <span className="flex items-center gap-0.5 rounded-full bg-amber-100 px-2 py-0.5 text-xs text-amber-700 dark:bg-amber-900/30 dark:text-amber-300">
                      <WifiOff className="h-3 w-3" /> offline
                    </span>
                  )}
                </div>
                {d.message && (
                  <p className="mt-1.5 text-sm italic text-slate-500 dark:text-slate-400">
                    &ldquo;{d.message}&rdquo;
                  </p>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}

      {donations.length < total && (
        <button
          onClick={loadMore}
          className="mt-4 w-full rounded-xl border border-slate-200 py-2 text-sm text-slate-600 transition-colors hover:bg-slate-50 dark:border-slate-700 dark:text-slate-400 dark:hover:bg-slate-800"
        >
          Show more ({total - donations.length} remaining)
        </button>
      )}
    </div>
  );
}
