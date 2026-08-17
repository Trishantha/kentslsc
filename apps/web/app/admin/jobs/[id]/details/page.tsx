'use client';

import { useParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, Loader2 } from 'lucide-react';
import Link from 'next/link';
import { api, getApiErrorMessage } from '@/lib/api';
import { JobDetailsForm } from './JobDetailsForm';
import type { AdminJob } from '../../types';

export default function JobDetailsPage() {
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
      <JobDetailsForm job={job} jobId={id} />
    </div>
  );
}
