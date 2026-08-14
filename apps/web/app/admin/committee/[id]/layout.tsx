import Link from 'next/link';
import { ArrowLeft, Users } from 'lucide-react';
import { fetchWithOriginFallback } from '@/lib/server-api-fetch';
import { notFound } from 'next/navigation';
import { AdminDetailTabs } from '@/components/admin/AdminDetailTabs';
import { Info } from 'lucide-react';
import type { AdminCommitteeMember } from '../page';

interface CommitteeDetailLayoutProps {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
}

async function getCommitteeMember(id: string): Promise<AdminCommitteeMember | null> {
  return fetchWithOriginFallback(`/api/admin/committee/${id}`);
}

const tabs = [
  { href: 'details', label: 'Details', icon: Info }
];

export default async function CommitteeDetailLayout({ children, params }: CommitteeDetailLayoutProps) {
  const { id } = await params;
  const member = await getCommitteeMember(id);
  if (!member) notFound();

  return (
    <div>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <Link
            href="/admin/committee"
            className="mt-1 rounded-lg p-2 text-slate-500 hover:bg-white/5 hover:text-slate-300"
          >
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div>
            <h1 className="section-title">{member.name}</h1>
            <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-slate-500">
              <Users className="h-3.5 w-3.5" />
              <span>{member.position}</span>
              <span>·</span>
              <span className="text-slate-600 dark:text-slate-400">{member.roleKey}</span>
            </div>
          </div>
        </div>
      </div>

      <div className="mt-4">
        <AdminDetailTabs tabs={tabs} basePath={`/admin/committee/${id}`} />
      </div>

      {children}
    </div>
  );
}
