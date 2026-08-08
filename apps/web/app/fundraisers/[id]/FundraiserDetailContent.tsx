'use client';

import { useEffect, useState } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import { api } from '@/lib/api';

export interface Fundraiser {
  id: string;
  title: string;
  description?: string;
  targetAmount: number;
  raisedAmount: number;
  imageUrl?: string;
  aiSummary?: string;
  startDate: string;
  endDate: string;
  createdAt: string;
  updatedAt: string;
}

interface Props {
  fundraiser: Fundraiser;
}

export default function FundraiserDetailContent({ fundraiser: initialFundraiser }: Props) {
  const params = useParams();
  const searchParams = useSearchParams();
  const id = (params?.id ?? '') as string;
  const [fundraiser, setFundraiser] = useState<Fundraiser>(initialFundraiser);
  const [amount, setAmount] = useState('');
  const [error, setError] = useState('');
  const success = searchParams?.get('success');
  const canceled = searchParams?.get('canceled');

  useEffect(() => {
    api
      .get(`/fundraisers/${id}`)
      .then((res) => setFundraiser(res.data))
      .catch(() => setError('Failed to load fundraiser'));
  }, [id]);

  const handleDonate = async () => {
    const value = Number(amount);
    if (!value || value < 1) return;
    try {
      const res = await api.post(`/fundraisers/${id}/donate`, { fundraiserId: id, amount: value });
      if (res.data.url) {
        window.location.href = res.data.url;
      }
    } catch {
      setError('Could not start donation. Please log in first.');
    }
  };

  const progress =
    fundraiser.targetAmount > 0
      ? Math.min((fundraiser.raisedAmount / fundraiser.targetAmount) * 100, 100)
      : 0;

  return (
    <div className="px-4 py-16 md:px-6">
      <div className="mx-auto max-w-3xl">
        {success && (
          <div className="mb-6 rounded-xl bg-green-100 p-4 text-green-800 dark:bg-green-900/30 dark:text-green-200">
            Thank you for your donation!
          </div>
        )}
        {canceled && (
          <div className="mb-6 rounded-xl bg-amber-100 p-4 text-amber-800 dark:bg-amber-900/30 dark:text-amber-200">
            Donation canceled.
          </div>
        )}

        <div className="glass-card p-8">
          {fundraiser.imageUrl ? (
            <img
              src={fundraiser.imageUrl}
              alt={fundraiser.title}
              className="mb-6 h-64 w-full rounded-xl object-cover"
            />
          ) : (
            <div className="mb-6 h-64 w-full rounded-xl bg-gradient-to-br from-neon-blue/30 to-neon-gold/30" />
          )}
          <h1 className="section-title">{fundraiser.title}</h1>
          {fundraiser.aiSummary ? (
            <p className="mt-4 text-slate-600 dark:text-slate-300">{fundraiser.aiSummary}</p>
          ) : (
            <p className="mt-4 text-slate-600 dark:text-slate-300">{fundraiser.description}</p>
          )}

          <div className="mt-8">
            <div className="h-4 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700">
              <div
                className="h-full rounded-full bg-gradient-to-r from-neon-blue to-neon-gold"
                style={{ width: `${progress}%` }}
              />
            </div>
            <div className="mt-2 flex justify-between text-sm">
              <span>£{fundraiser.raisedAmount.toLocaleString()} raised</span>
              <span>Goal: £{fundraiser.targetAmount.toLocaleString()}</span>
            </div>
          </div>

          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <input
              type="number"
              min="1"
              step="1"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="Amount (£)"
              className="flex-1 rounded-xl border border-slate-200 bg-white px-4 py-3 text-slate-900 outline-none focus:border-neon-blue dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
            />
            <button onClick={handleDonate} className="btn-primary px-8">
              Donate
            </button>
          </div>
          {error && <p className="mt-3 text-sm text-red-500">{error}</p>}
        </div>
      </div>
    </div>
  );
}
