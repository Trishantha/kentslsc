'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, Users, Info, Loader2 } from 'lucide-react';
import { api, getApiErrorMessage } from '@/lib/api';
import { AdminDetailTabs } from '@/components/admin/AdminDetailTabs';
import type { AdminCommitteeMember } from '../page';

const tabs = [
  { href: 'details', label: 'Details', icon: Info }
];

interface CommitteeDetailLayoutProps {
  children: React.ReactNode;
}

export default function CommitteeDetailLayout({ children }: CommitteeDetailLayoutProps) {
  const { id } = useParams<{ id: string }>();

  const {
    data: member,
    isLoading,
    error
  } = useQuery<AdminCommitteeMember>({
    queryKey: ['admin', 'committee', id],
    queryFn: async () => {
      const res = await api.get(`/admin/committee/${id}`);
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

  if (error || !member) {
    return (
      <div className="glass-card p-8 text-center">
        <h2 className="text-xl font-semibold text-red-400">Could not load committee member</h2>
        <p className="mt-2 text-slate-500">
          {error ? getApiErrorMessage(error) : 'Committee member not found.'}
        </p>
        <Link
          href="/admin/committee"
          className="mt-6 inline-flex items-center gap-2 text-sm font-medium text-neon-blue hover:underline"
        >
          <ArrowLeft className="h-4 w-4" /> Back to committee
        </Link>
      </div>
    );
  }

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
