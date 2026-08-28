'use client';

import { SmartLink } from '@/components/ui/SmartLink';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { ArrowRight } from 'lucide-react';
import { api } from '@/lib/api';
import type { FundraisersBlock } from '@kentslsc/shared';

interface Props {
  block: FundraisersBlock;
}

interface FundraiserItem {
  id: string;
  title: string;
  description?: string;
  targetAmount: number;
  raisedAmount: number;
  imageUrl?: string;
  aiSummary?: string;
}

export default function FundraisersBlockComponent({ block }: Props) {
  const { title, limit = 3 } = block;

  const { data: fundraisers = [], isLoading } = useQuery<FundraiserItem[]>({
    queryKey: ['blocks', 'fundraisers', limit],
    queryFn: async () => {
      const { data } = await api.get('/fundraisers', { params: { limit } });
      return data?.items ?? [];
    }
  });

  return (
    <section className="px-4 py-16 md:px-6">
      <div className="mx-auto max-w-7xl">
        <div className="mb-8 flex items-end justify-between">
          <div>{title && <h2 className="section-title">{title}</h2>}</div>
          <SmartLink href="/fundraisers" className="hidden text-sm font-semibold text-neon-blue sm:inline-flex">
            View all <ArrowRight className="ml-1 h-4 w-4" />
          </SmartLink>
        </div>

        {isLoading ? (
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
                <motion.div
                  key={f.id}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: index * 0.05 }}
                >
                  <SmartLink href={`/fundraisers/${f.id}`}>
                    <div className="glass-card flex h-full flex-col p-6">
                      {f.imageUrl ? (
                        <img src={f.imageUrl} alt={f.title} className="mb-4 h-40 w-full rounded-xl object-contain" />
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
                </motion.div>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}
