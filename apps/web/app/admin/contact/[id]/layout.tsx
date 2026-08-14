import Link from 'next/link';
import { ArrowLeft, Mail, MessageSquare, CheckCircle } from 'lucide-react';
import { fetchWithOriginFallback } from '@/lib/server-api-fetch';
import { notFound } from 'next/navigation';
import { AdminDetailTabs } from '@/components/admin/AdminDetailTabs';
import type { ContactMessage } from '../types';

interface ContactDetailLayoutProps {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
}

async function getContactMessage(id: string): Promise<ContactMessage | null> {
  return fetchWithOriginFallback(`/api/admin/contact-messages/${id}`);
}

const tabs = [
  { href: 'message', label: 'Message', icon: MessageSquare },
  { href: 'status', label: 'Status', icon: CheckCircle }
];

export default async function ContactDetailLayout({ children, params }: ContactDetailLayoutProps) {
  const { id } = await params;
  const message = await getContactMessage(id);
  if (!message) notFound();

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
