'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';

interface Fundraiser {
  id: string;
  title: string;
  description?: string;
  targetAmount: number;
  raisedAmount: number;
  imageUrl?: string;
  aiSummary?: string;
  endDate: string;
}

export default function FundraisersPage() {
  const [fundraisers, setFundraisers] = useState<Fundraiser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    api
      .get('/fundraisers')
      .then((res) => setFundraisers(res.data))
      .catch(() => setError('Failed to load fundraisers'))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="px-4 py-16 md:px-6">
      <div className="mx-auto max-w-6xl">
        <h1 className="section-title">Fundraising</h1>
        <p className="mt-4 text-slate-600 dark:text-slate-400">
          Support our community causes and see the impact of your donations.
        </p>

        {loading && <p className="mt-10 text-slate-500">Loading...</p>}
        {error && <p className="mt-10 text-red-500">{error}</p>}

        <div className="mt-10 grid gap-6 sm:grid-cols-2">
          {fundraisers.map((f) => {
            const progress = f.targetAmount > 0 ? Math.min((f.raisedAmount / f.targetAmount) * 100, 100) : 0;
            return (
              <div key={f.id} className="glass-card flex flex-col p-6">
                {f.imageUrl ? (
                  <img src={f.imageUrl} alt={f.title} className="mb-4 h-40 w-full rounded-xl object-cover" />
                ) : (
                  <div className="mb-4 h-40 w-full rounded-xl bg-gradient-to-br from-neon-blue/30 to-neon-gold/30" />
                )}
                <h3 className="text-xl font-bold">{f.title}</h3>
                {f.aiSummary ? (
                  <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">{f.aiSummary}</p>
                ) : f.description ? (
                  <p className="mt-2 line-clamp-2 text-sm text-slate-600 dark:text-slate-400">{f.description}</p>
                ) : null}
                <div className="mt-4 h-3 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-neon-blue to-neon-gold"
                    style={{ width: `${progress}%` }}
                  />
                </div>
                <div className="mt-2 flex justify-between text-sm">
                  <span>£{f.raisedAmount.toLocaleString()} raised</span>
                  <span>Goal: £{f.targetAmount.toLocaleString()}</span>
                </div>
                <Link href={`/fundraisers/${f.id}`} className="btn-primary mt-6 w-full py-2 text-sm">
                  Donate
                </Link>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
