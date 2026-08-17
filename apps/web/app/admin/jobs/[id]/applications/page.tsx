'use client';

import { useParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, Users, FileText, Loader2 } from 'lucide-react';
import Link from 'next/link';
import { api, getApiErrorMessage } from '@/lib/api';
import type { AdminJob } from '../../types';

export default function JobApplicationsPage() {
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

  return (
    <div className="max-w-3xl">
      <div className="glass-card p-6">
        <div className="flex items-start gap-4">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-neon-blue/10 text-neon-blue">
            <Users className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-lg font-bold">Applications</h2>
            <p className="mt-1 text-sm text-slate-500">
              Job applications for <span className="font-medium text-slate-300">{job.title}</span>{' '}
              are not yet available through the admin API.
            </p>
            <div className="mt-4 flex items-start gap-3 rounded-xl border border-amber-500/20 bg-amber-500/10 p-4 text-sm text-amber-200">
              <FileText className="mt-0.5 h-4 w-4 shrink-0" />
              <p>
                There is currently no <code>/admin/directory/jobs/:id/applications</code> endpoint
                in the API. Once applications are stored and exposed, this tab can list submitted
                CVs and contact details.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
