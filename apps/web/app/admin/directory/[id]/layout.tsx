'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, Building2, Info, Briefcase, ImageIcon, Loader2 } from 'lucide-react';
import { api, getApiErrorMessage } from '@/lib/api';
import { AdminDetailTabs } from '@/components/admin/AdminDetailTabs';
import type { AdminBusiness } from '../types';

const tabs = [
  { href: 'details', label: 'Details', icon: Info },
  { href: 'jobs', label: 'Jobs', icon: Briefcase },
  { href: 'media', label: 'Media', icon: ImageIcon }
];

interface DirectoryDetailLayoutProps {
  children: React.ReactNode;
}

export default function DirectoryDetailLayout({ children }: DirectoryDetailLayoutProps) {
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
    <div>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <Link
            href="/admin/directory"
            className="mt-1 rounded-lg p-2 text-slate-500 hover:bg-white/5 hover:text-slate-300"
          >
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div>
            <h1 className="section-title">{business.businessName}</h1>
            <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-slate-500">
              <Building2 className="h-3.5 w-3.5" />
              <span>{business.category || 'Uncategorised'}</span>
              {business.isPaid && (
                <span className="rounded-full bg-green-500/10 px-2 py-0.5 text-xs font-semibold text-green-400">
                  Paid
                </span>
              )}
              {business.isPromoted && (
                <span className="rounded-full bg-neon-blue/10 px-2 py-0.5 text-xs font-semibold text-neon-blue">
                  Featured
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="mt-4">
        <AdminDetailTabs tabs={tabs} basePath={`/admin/directory/${id}`} />
      </div>

      {children}
    </div>
  );
}
