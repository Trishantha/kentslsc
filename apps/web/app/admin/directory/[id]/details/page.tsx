'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, Loader2 } from 'lucide-react';
import { api, getApiErrorMessage } from '@/lib/api';
import { BusinessDetailsForm } from './BusinessDetailsForm';
import type { AdminBusiness } from '../../types';

export default function DirectoryDetailsPage() {
  const { id } = useParams<{ id: string }>();

  const {
    data: business,
    isLoading,
    error
  } = useQuery<AdminBusiness>({
    queryKey: ['admin', 'directory', id],
    queryFn: async () => {
      const res = await api.get(`/directory/businesses/${id}`);
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

  if (error || !business) {
    return (
      <div className="glass-card p-8 text-center">
        <h2 className="text-xl font-semibold text-red-400">Could not load business</h2>
        <p className="mt-2 text-slate-500">
          {error ? getApiErrorMessage(error) : 'Business not found.'}
        </p>
        <Link
          href="/admin/directory"
          className="mt-6 inline-flex items-center gap-2 text-sm font-medium text-neon-blue hover:underline"
        >
          <ArrowLeft className="h-4 w-4" /> Back to directory
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-3xl">
      <BusinessDetailsForm business={business} businessId={id} />
    </div>
  );
}
