'use client';

import { useParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, Loader2 } from 'lucide-react';
import Link from 'next/link';
import { api, getApiErrorMessage } from '@/lib/api';
import { FundraiserOverviewForm } from './FundraiserOverviewForm';
import type { AdminFundraiser } from '../../types';

export default function FundraiserOverviewPage() {
  const { id } = useParams<{ id: string }>();

  const {
    data: fundraiser,
    isLoading,
    error
  } = useQuery<AdminFundraiser>({
    queryKey: ['admin', 'fundraisers', id],
    queryFn: async () => {
      const res = await api.get(`/fundraisers/${id}`);
      return res.data;
    },
    enabled: !!id
  });

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-neon-blue" />
      </div>
    );
  }

  if (error || !fundraiser) {
    return (
      <div className="glass-card p-8 text-center">
        <h2 className="text-xl font-semibold text-red-400">Could not load fundraiser</h2>
        <p className="mt-2 text-slate-500">
          {error ? getApiErrorMessage(error) : 'Fundraiser not found.'}
        </p>
        <Link
          href="/admin/fundraisers"
          className="mt-6 inline-flex items-center gap-2 text-sm font-medium text-neon-blue hover:underline"
        >
          <ArrowLeft className="h-4 w-4" /> Back to fundraisers
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-3xl">
      <FundraiserOverviewForm fundraiser={fundraiser} fundraiserId={id} />
    </div>
  );
}
