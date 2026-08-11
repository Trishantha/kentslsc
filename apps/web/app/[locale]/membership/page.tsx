'use client';

import { useQuery } from '@tanstack/react-query';
import { Loader2, Check, ArrowRight } from 'lucide-react';
import { Link } from '@/i18n/routing';
import { api } from '@/lib/api';
import { useAuth } from '@/hooks/useAuth';
import { MembershipFeature, membershipFeatureLabels } from '@kentslsc/shared';

interface MembershipType {
  id: string;
  name: string;
  description?: string | null;
  price: number;
  isFree: boolean;
  durationMonths: number;
  maxIssuances?: number | null;
  issuedCount?: number;
  hasCapacity?: boolean;
  benefits: string[];
  features: MembershipFeature[];
}

function formatPrice(type: MembershipType) {
  if (type.isFree || type.price === 0) return 'Free';
  return new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' }).format(type.price);
}

export default function MembershipPlansPage() {
  const { data: user } = useAuth();
  const { data: types = [], isLoading } = useQuery<MembershipType[]>({
    queryKey: ['membership-types'],
    queryFn: async () => {
      const res = await api.get('/membership/types');
      return res.data;
    }
  });

  return (
    <div className="px-4 py-14 md:px-6 md:py-16">
      <div className="mx-auto max-w-6xl">
        <div className="glass-card p-8 md:p-10">
          <h1 className="section-title">Membership Options</h1>
          <p className="mt-3 max-w-3xl text-slate-700 dark:text-slate-400">
            Explore available membership categories, compare benefits, and choose the plan that fits your family or business.
          </p>
          <div className="mt-6">
            <Link
              href={user ? '/dashboard' : '/auth/register'}
              className="btn-primary inline-flex items-center"
            >
              {user ? 'Go to member dashboard' : 'Become a Member'}
              <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </div>
        </div>

        {isLoading ? (
          <div className="mt-10 flex justify-center">
            <Loader2 className="h-7 w-7 animate-spin text-neon-blue" />
          </div>
        ) : (
          <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {types.map((type) => {
              const atCapacity = type.hasCapacity === false;
              const detailsHref = user ? '/dashboard' : `/auth/register?type=${type.id}`;
              const waitlistHref = `/contact?subject=${encodeURIComponent(`Membership waitlist: ${type.name}`)}&message=${encodeURIComponent(`Please add me to the waitlist for ${type.name}.`)}`;
              return (
                <div key={type.id} className="glass-card flex flex-col p-6">
                  <div className="flex items-start justify-between gap-3">
                    <h2 className="text-xl font-bold">{type.name}</h2>
                    {atCapacity ? (
                      <span className="rounded-full bg-red-500/20 px-2 py-1 text-[10px] font-semibold uppercase text-red-400">
                        Full
                      </span>
                    ) : null}
                  </div>
                  <p className="mt-2 text-2xl font-bold gradient-text">{formatPrice(type)}</p>
                  <p className="mt-1 text-xs text-slate-600 dark:text-slate-400">
                    {type.isFree ? 'Lifetime' : `${type.durationMonths} months`}
                  </p>
                  {type.maxIssuances ? (
                    <p className="mt-1 text-xs text-slate-600 dark:text-slate-400">
                      {type.issuedCount ?? 0}/{type.maxIssuances} issued
                    </p>
                  ) : (
                    <p className="mt-1 text-xs text-slate-600 dark:text-slate-400">Unlimited membership slots</p>
                  )}
                  {type.description ? (
                    <p className="mt-3 text-sm text-slate-700 dark:text-slate-400">{type.description}</p>
                  ) : null}

                  <ul className="mt-4 flex-1 space-y-2 text-sm text-slate-700 dark:text-slate-400">
                    {type.features.slice(0, 6).map((feature) => (
                      <li key={feature} className="flex items-start gap-2">
                        <Check className="mt-0.5 h-4 w-4 flex-shrink-0 text-neon-blue" />
                        <span>{membershipFeatureLabels[feature]?.label ?? feature}</span>
                      </li>
                    ))}
                    {type.features.length === 0 && <li>No included features listed.</li>}
                  </ul>

                  {atCapacity ? (
                    <div className="mt-5 space-y-2">
                      <p className="text-xs text-slate-600 dark:text-slate-400">This category is currently full.</p>
                      <Link
                        href={waitlistHref}
                        className="inline-flex w-full items-center justify-center rounded-xl border border-neon-gold/40 px-4 py-2 text-sm font-semibold text-neon-gold transition-colors hover:bg-neon-gold/10"
                      >
                        Join waitlist
                      </Link>
                    </div>
                  ) : (
                    <Link
                      href={detailsHref}
                      className="mt-5 inline-flex items-center justify-center rounded-xl bg-neon-blue px-4 py-2 text-sm font-semibold text-slate-950 transition-colors hover:bg-neon-blue/90"
                    >
                      Become a member
                    </Link>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
