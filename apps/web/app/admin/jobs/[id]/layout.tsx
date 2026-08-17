'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, Briefcase, Building2, Info, Users, Loader2 } from 'lucide-react';
import { api, getApiErrorMessage } from '@/lib/api';
import { AdminDetailTabs } from '@/components/admin/AdminDetailTabs';
import type { AdminJob } from '../types';

const tabs = [
  { href: 'details', label: 'Details', icon: Info },
  { href: 'applications', label: 'Applications', icon: Users }
];

interface JobDetailLayoutProps {
  children: React.ReactNode;
}

export default function JobDetailLayout({ children }: JobDetailLayoutProps) {
  const { id } = useParams<{ id: string }>();

  const {
    data: job,
    isLoading,
    error
  } = useQuery<AdminJob | null>({
    queryKey: ['admin', 'jobs', id],
    queryFn: async () => {
      const res = await api.get<AdminJob[]>('/admin/directory/jobs');
      return res.data.find((j) => j.id === id) ?? null;
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

  if (error || !job) {
    return (
      <div className="glass-card p-8 text-center">
        <h2 className="text-xl font-semibold text-red-400">Could not load job</h2>
        <p className="mt-2 text-slate-500">
          {error ? getApiErrorMessage(error) : 'Job not found.'}
        </p>
        <Link
          href="/admin/jobs"
          className="mt-6 inline-flex items-center gap-2 text-sm font-medium text-neon-blue hover:underline"
        >
          <ArrowLeft className="h-4 w-4" /> Back to jobs
        </Link>
      </div>
    );
  }

  const hasClosed = job.closingDate ? new Date(job.closingDate) < new Date() : false;

  return (
    <div>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <Link
            href="/admin/jobs"
            className="mt-1 rounded-lg p-2 text-slate-500 hover:bg-white/5 hover:text-slate-300"
          >
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div>
            <h1 className="section-title">{job.title}</h1>
            <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-slate-500">
              <Briefcase className="h-3.5 w-3.5" />
              <span>{job.location || 'No location'}</span>
              {job.businessListing && (
                <>
                  <span>·</span>
                  <Building2 className="h-3.5 w-3.5" />
                  <span>{job.businessListing.businessName}</span>
                </>
              )}
              <span
                className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                  job.isPublished
                    ? 'bg-green-500/10 text-green-400'
                    : 'bg-slate-500/10 text-slate-400'
                }`}
              >
                {job.isPublished ? 'Published' : 'Draft'}
              </span>
              {hasClosed && (
                <span className="rounded-full bg-amber-500/10 px-2 py-0.5 text-xs font-semibold text-amber-400">
                  Closed
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="mt-4">
        <AdminDetailTabs tabs={tabs} basePath={`/admin/jobs/${id}`} />
      </div>

      {children}
    </div>
  );
}
