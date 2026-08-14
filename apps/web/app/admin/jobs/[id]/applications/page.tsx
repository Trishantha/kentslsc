import { fetchWithOriginFallback } from '@/lib/server-api-fetch';
import { notFound } from 'next/navigation';
import { Users, FileText } from 'lucide-react';
import type { AdminJob } from '../../types';

interface Props {
  params: Promise<{ id: string }>;
}

async function getJob(id: string): Promise<AdminJob | null> {
  const jobs = await fetchWithOriginFallback<AdminJob[]>('/api/admin/directory/jobs');
  if (!jobs) return null;
  return jobs.find((j) => j.id === id) ?? null;
}

export default async function JobApplicationsPage({ params }: Props) {
  const { id } = await params;
  const job = await getJob(id);
  if (!job) notFound();

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
