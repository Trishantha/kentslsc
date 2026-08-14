import Link from 'next/link';
import { ArrowLeft, Building2 } from 'lucide-react';
import { fetchWithOriginFallback } from '@/lib/server-api-fetch';
import { notFound } from 'next/navigation';
import { AdminDetailTabs } from '@/components/admin/AdminDetailTabs';
import { Info, Briefcase, ImageIcon } from 'lucide-react';
import type { AdminBusiness } from '../types';

interface DirectoryDetailLayoutProps {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
}

const tabs = [
  { href: 'details', label: 'Details', icon: Info },
  { href: 'jobs', label: 'Jobs', icon: Briefcase },
  { href: 'media', label: 'Media', icon: ImageIcon }
];

async function getBusiness(id: string): Promise<AdminBusiness | null> {
  return fetchWithOriginFallback(`/api/directory/businesses/${id}`);
}

export default async function DirectoryDetailLayout({
  children,
  params
}: DirectoryDetailLayoutProps) {
  const { id } = await params;
  const business = await getBusiness(id);
  if (!business) notFound();

  return (
    <div>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <Link
            href="/admin/directory"
            className="mt-1 rounded-lg p-2 text-slate-500 hover:bg-white/5 hover:text-slate-300"
          >
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div>
            <h1 className="section-title">{business.businessName}</h1>
            <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-slate-500">
              <Building2 className="h-3.5 w-3.5" />
              <span>{business.category || 'Uncategorised'}</span>
              {business.isPaid && (
                <span className="rounded-full bg-green-500/10 px-2 py-0.5 text-xs font-semibold text-green-400">
                  Paid
                </span>
              )}
              {business.isPromoted && (
                <span className="rounded-full bg-neon-blue/10 px-2 py-0.5 text-xs font-semibold text-neon-blue">
                  Promoted
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="mt-4">
        <AdminDetailTabs tabs={tabs} basePath={`/admin/directory/${id}`} />
      </div>

      {children}
    </div>
  );
}
