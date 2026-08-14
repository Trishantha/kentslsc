import { fetchWithOriginFallback } from '@/lib/server-api-fetch';
import { notFound } from 'next/navigation';
import { JobDetailsForm } from './JobDetailsForm';
import type { AdminJob } from '../../types';

interface Props {
  params: Promise<{ id: string }>;
}

async function getJob(id: string): Promise<AdminJob | null> {
  const jobs = await fetchWithOriginFallback<AdminJob[]>('/api/admin/directory/jobs');
  if (!jobs) return null;
  return jobs.find((j) => j.id === id) ?? null;
}

export default async function JobDetailsPage({ params }: Props) {
  const { id } = await params;
  const job = await getJob(id);
  if (!job) notFound();

  return (
    <div className="max-w-3xl">
      <JobDetailsForm job={job} jobId={id} />
    </div>
  );
}
