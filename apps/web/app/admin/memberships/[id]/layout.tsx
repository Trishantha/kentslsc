import Link from 'next/link';
import { ArrowLeft, CreditCard, Info, User } from 'lucide-react';
import { fetchWithOriginFallback } from '@/lib/server-api-fetch';
import { notFound } from 'next/navigation';
import { AdminDetailTabs } from '@/components/admin/AdminDetailTabs';
import type { AdminMembership } from '../types';

interface MembershipDetailLayoutProps {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
}

async function getMembership(id: string): Promise<AdminMembership | null> {
  return fetchWithOriginFallback(`/api/admin/memberships/${id}`);
}

const tabs = [
  { href: 'details', label: 'Details', icon: Info },
  { href: 'card', label: 'Card', icon: CreditCard }
];

export default async function MembershipDetailLayout({
  children,
  params
}: MembershipDetailLayoutProps) {
  const { id } = await params;
  const membership = await getMembership(id);
  if (!membership) notFound();

  const isExpired = membership.endDate ? new Date(membership.endDate) < new Date() : false;

  return (
    <div>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <Link
            href="/admin/memberships"
            className="mt-1 rounded-lg p-2 text-slate-500 hover:bg-white/5 hover:text-slate-300"
          >
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div>
            <h1 className="section-title">{membership.user.name}</h1>
            <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-slate-500">
              <User className="h-3.5 w-3.5" />
              <span>{membership.user.email}</span>
              <span>·</span>
              <CreditCard className="h-3.5 w-3.5" />
              <span>{membership.membershipType.name}</span>
              <span
                className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                  membership.status === 'ACTIVE'
                    ? 'bg-green-500/10 text-green-400'
                    : membership.status === 'PENDING'
                      ? 'bg-yellow-500/10 text-yellow-400'
                      : 'bg-red-500/10 text-red-400'
                }`}
              >
                {membership.status}
              </span>
              {isExpired && (
                <span className="rounded-full bg-amber-500/10 px-2 py-0.5 text-xs font-semibold text-amber-400">
                  Expired
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="mt-4">
        <AdminDetailTabs tabs={tabs} basePath={`/admin/memberships/${id}`} />
      </div>

      {children}
    </div>
  );
}
