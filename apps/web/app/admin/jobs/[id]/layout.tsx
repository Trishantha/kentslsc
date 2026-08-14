import Link from 'next/link';
import { ArrowLeft, Briefcase, Building2 } from 'lucide-react';
import { fetchWithOriginFallback } from '@/lib/server-api-fetch';
import { notFound } from 'next/navigation';
import { AdminDetailTabs } from '@/components/admin/AdminDetailTabs';
import { Info, Users } from 'lucide-react';
import type { AdminJob } from '../types';

interface JobDetailLayoutProps {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
}

async function getJob(id: string): Promise<AdminJob | null> {
  const jobs = await fetchWithOriginFallback<AdminJob[]>('/api/admin/directory/jobs');
  if (!jobs) return null;
  return jobs.find((j) => j.id === id) ?? null;
}

const tabs = [
  { href: 'details', label: 'Details', icon: Info },
  { href: 'applications', label: 'Applications', icon: Users }
];

export default async function JobDetailLayout({ children, params }: JobDetailLayoutProps) {
  const { id } = await params;
  const job = await getJob(id);
  if (!job) notFound();

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
