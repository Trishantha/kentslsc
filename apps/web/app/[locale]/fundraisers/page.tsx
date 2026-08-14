'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/routing';
import { Loader2, Plus } from 'lucide-react';
import { api } from '@/lib/api';
import { FundraiserCard, type FundraiserCardData } from '@/components/fundraising/FundraiserCard';

const CATEGORIES = [
  { value: '', label: 'All' },
  { value: 'CHARITY', label: 'Charity' },
  { value: 'SPORTS', label: 'Sports' },
  { value: 'COMMUNITY', label: 'Community' },
  { value: 'MEMORIAL', label: 'Memorial' },
  { value: 'MEDICAL', label: 'Medical' },
  { value: 'OTHER', label: 'Other' }
];

export default function FundraisersPage() {
  const t = useTranslations('fundraisers');
  const [fundraisers, setFundraisers] = useState<FundraiserCardData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [category, setCategory] = useState('');
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);

  const fetchPage = (cat: string, p: number, append = false) => {
    setLoading(true);
    api
      .get('/fundraisers', { params: { category: cat || undefined, page: p, limit: 12 } })
      .then((res) => {
        const data = res.data;
        setFundraisers((prev) => (append ? [...prev, ...data.items] : data.items));
        setTotal(data.total);
      })
      .catch(() => setError(t('loadError')))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    setPage(1);
    fetchPage(category, 1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [category]);

  const loadMore = () => {
    const next = page + 1;
    setPage(next);
    fetchPage(category, next, true);
  };

  return (
    <div className="px-4 py-16 md:px-6">
      <div className="mx-auto max-w-6xl">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="section-title">{t('title')}</h1>
            <p className="mt-2 text-slate-600 dark:text-slate-400">{t('subtitle')}</p>
          </div>
          <Link href="/fundraisers/create" className="btn-primary flex items-center gap-2">
            <Plus className="h-4 w-4" />
            {t('startCampaign')}
          </Link>
        </div>

        {/* Category filter tabs */}
        <div className="mt-8 flex flex-wrap gap-2">
          {CATEGORIES.map((c) => (
            <button
              key={c.value}
              onClick={() => setCategory(c.value)}
              className={`rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
                category === c.value
                  ? 'bg-neon-blue text-white'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700'
              }`}
            >
              {c.label}
            </button>
          ))}
        </div>

        {error && <p className="mt-8 text-red-500">{error}</p>}

        {!error && fundraisers.length === 0 && !loading && (
          <div className="mt-20 text-center text-slate-400">
            <p>No active campaigns found{category ? ' in this category' : ''}.</p>
            <Link href="/fundraisers/create" className="btn-primary mt-4 inline-flex items-center gap-2">
              <Plus className="h-4 w-4" /> Start the first campaign
            </Link>
          </div>
        )}

        <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {fundraisers.map((f) => (
            <FundraiserCard key={f.id} fundraiser={f} />
          ))}
        </div>

        {loading && (
          <div className="mt-10 flex justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-neon-blue" />
          </div>
        )}

        {!loading && fundraisers.length < total && (
          <div className="mt-10 flex justify-center">
            <button onClick={loadMore} className="btn-secondary px-8">
              Load more
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

