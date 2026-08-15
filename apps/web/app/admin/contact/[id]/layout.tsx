'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, Mail, MessageSquare, CheckCircle, Loader2 } from 'lucide-react';
import { api, getApiErrorMessage } from '@/lib/api';
import { AdminDetailTabs } from '@/components/admin/AdminDetailTabs';
import type { ContactMessage } from '../types';

const tabs = [
  { href: 'message', label: 'Message', icon: MessageSquare },
  { href: 'status', label: 'Status', icon: CheckCircle }
];

interface ContactDetailLayoutProps {
  children: React.ReactNode;
}

export default function ContactDetailLayout({ children }: ContactDetailLayoutProps) {
  const { id } = useParams<{ id: string }>();

  const {
    data: message,
    isLoading,
    error
  } = useQuery<ContactMessage>({
    queryKey: ['admin', 'contact-messages', id],
    queryFn: async () => {
      const res = await api.get(`/admin/contact-messages/${id}`);
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

  if (error || !message) {
    return (
      <div className="glass-card p-8 text-center">
        <h2 className="text-xl font-semibold text-red-400">Could not load message</h2>
        <p className="mt-2 text-slate-500">
          {error ? getApiErrorMessage(error) : 'Message not found.'}
        </p>
        <Link
          href="/admin/contact"
          className="mt-6 inline-flex items-center gap-2 text-sm font-medium text-neon-blue hover:underline"
        >
          <ArrowLeft className="h-4 w-4" /> Back to contact messages
        </Link>
      </div>
    );
  }

  const statusColor =
    message.handledStatus === 'RESOLVED'
      ? 'bg-green-500/10 text-green-400'
      : message.handledStatus === 'IN_PROGRESS'
        ? 'bg-yellow-500/10 text-yellow-400'
        : 'bg-slate-500/10 text-slate-400';

  return (
    <div>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <Link
            href="/admin/contact"
            className="mt-1 rounded-lg p-2 text-slate-500 hover:bg-white/5 hover:text-slate-300"
          >
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div>
            <h1 className="section-title">{message.subject}</h1>
            <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-slate-500">
              <Mail className="h-3.5 w-3.5" />
              <span>{message.name}</span>
              <span>·</span>
              <span>{message.email}</span>
              <span
                className={`rounded-full px-2 py-0.5 text-xs font-semibold ${statusColor}`}
              >
                {message.handledStatus}
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="mt-4">
        <AdminDetailTabs tabs={tabs} basePath={`/admin/contact/${id}`} />
      </div>

      {children}
    </div>
  );
}
