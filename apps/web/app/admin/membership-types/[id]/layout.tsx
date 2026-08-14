import Link from 'next/link';
import { ArrowLeft, Ticket } from 'lucide-react';
import { Info, Banknote, Sparkles } from 'lucide-react';
import { fetchWithOriginFallback } from '@/lib/server-api-fetch';
import { notFound } from 'next/navigation';
import { AdminDetailTabs } from '@/components/admin/AdminDetailTabs';
import type { AdminMembershipType } from '../types';

interface MembershipTypeDetailLayoutProps {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
}

async function getMembershipType(id: string): Promise<AdminMembershipType | null> {
  const types = await fetchWithOriginFallback<AdminMembershipType[]>('/api/membership/types');
  if (!types) return null;
  return types.find((t) => t.id === id) ?? null;
}

const tabs = [
  { href: 'details', label: 'Details', icon: Info },
  { href: 'pricing', label: 'Pricing', icon: Banknote },
  { href: 'features', label: 'Features', icon: Sparkles }
];

export default async function MembershipTypeDetailLayout({ children, params }: MembershipTypeDetailLayoutProps) {
  const { id } = await params;
  const type = await getMembershipType(id);
  if (!type) notFound();

  return (
    <div>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <Link
            href="/admin/membership-types"
            className="mt-1 rounded-lg p-2 text-slate-500 hover:bg-white/5 hover:text-slate-300"
          >
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div>
            <h1 className="section-title">{type.name}</h1>
            <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-slate-500">
              <Ticket className="h-3.5 w-3.5" />
              <span>{type.isFree || type.price === 0 ? 'Free' : `£${type.price}`}</span>
              <span>·</span>
              <span>{type.isFree ? 'Lifetime' : `${type.durationMonths} months`}</span>
              {type.autoActivate && (
                <span className="rounded-full bg-green-500/10 px-2 py-0.5 text-xs font-semibold text-green-400">
                  Auto-activate
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="mt-4">
        <AdminDetailTabs tabs={tabs} basePath={`/admin/membership-types/${id}`} />
      </div>

      {children}
    </div>
  );
}
