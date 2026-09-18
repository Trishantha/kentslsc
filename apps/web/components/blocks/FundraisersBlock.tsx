'use client';

import Image from 'next/image';
import { SmartLink } from '@/components/ui/SmartLink';
import { useQuery } from '@tanstack/react-query';
import { ArrowRight } from 'lucide-react';
import { api } from '@/lib/api';
import { FadeIn } from '@/components/ui/FadeIn';
import type { BlockFundraiserItem } from '@/lib/server-blocks';
import type { FundraisersBlock } from '@kentslsc/shared';

interface Props {
  block: FundraisersBlock;
  /** Server-prefetched fundraisers (keyed by block id). Falls back to client fetching. */
  data?: BlockFundraiserItem[];
}

interface FundraiserItem extends BlockFundraiserItem {}

export default function FundraisersBlockComponent({ block, data }: Props) {
  const { title, limit = 3 } = block;

  const { data: fetched, isLoading } = useQuery<FundraiserItem[]>({
    queryKey: ['blocks', 'fundraisers', limit],
    queryFn: async () => {
      const { data } = await api.get('/fundraisers', { params: { limit } });
      return data?.items ?? [];
    },
    enabled: data === undefined
  });

  const fundraisers = data ?? fetched ?? [];
  const showLoading = data === undefined && isLoading;

  return (
    <section className="px-4 py-16 md:px-6">
      <div className="mx-auto max-w-7xl">
        <div className="mb-8 flex items-end justify-between">
          <div>{title && <h2 className="section-title">{title}</h2>}</div>
          <SmartLink href="/fundraisers" className="hidden text-sm font-semibold text-neon-blue sm:inline-flex">
            View all <ArrowRight className="ml-1 h-4 w-4" />
          </SmartLink>
        </div>

        {showLoading ? (
          <div className="grid gap-6 md:grid-cols-2">
            {[1, 2].map((i) => (
              <div key={i} className="glass-card h-64 animate-pulse" />
            ))}
          </div>
        ) : fundraisers.length === 0 ? (
          <p className="text-slate-600 dark:text-slate-400">No active fundraisers right now.</p>
        ) : (
          <div className="grid gap-6 md:grid-cols-2">
            {fundraisers.slice(0, limit).map((f, index) => {
              const progress = f.targetAmount > 0 ? Math.min((f.raisedAmount / f.targetAmount) * 100, 100) : 0;
              return (
                <FadeIn key={f.id} delay={index * 0.05}>
                  <SmartLink href={`/fundraisers/${f.id}`}>
                    <div className="glass-card flex h-full flex-col p-6">
                      {f.imageUrl ? (
                        <div className="relative mb-4 h-40 w-full overflow-hidden rounded-xl">
                          <Image
                            src={f.imageUrl}
                            alt={f.title}
                            fill
                            sizes="(min-width: 768px) 50vw, 100vw"
                            className="object-contain"
                          />
                        </div>
                      ) : (
                        <div className="mb-4 h-40 w-full rounded-xl bg-gradient-to-br from-neon-blue/40 to-neon-gold/40" />
                      )}
                      <h3 className="text-xl font-bold">{f.title}</h3>
                      <p className="mt-2 line-clamp-2 text-sm text-slate-700 dark:text-slate-400">
                        {f.aiSummary ?? f.description ?? ''}
                      </p>
                      <div className="mt-4 h-3 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700">
                        <div
                          className="h-full rounded-full bg-gradient-to-r from-neon-blue to-neon-gold"
                          style={{ width: `${progress}%` }}
                        />
                      </div>
                      <div className="mt-2 flex justify-between text-sm">
                        <span>£{f.raisedAmount.toLocaleString()} raised</span>
                        <span>Goal: £{f.targetAmount.toLocaleString()}</span>
                      </div>
                    </div>
                  </SmartLink>
                </FadeIn>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}
