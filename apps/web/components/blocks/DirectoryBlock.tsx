'use client';

import { SmartLink } from '@/components/ui/SmartLink';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { ArrowRight } from 'lucide-react';
import { api } from '@/lib/api';
import type { DirectoryBlock } from '@kentslsc/shared';

interface Props {
  block: DirectoryBlock;
}

interface BusinessItem {
  id: string;
  businessName: string;
  description?: string;
  logoUrl?: string;
  category?: string;
  isPromoted?: boolean;
}

export default function DirectoryBlockComponent({ block }: Props) {
  const { title, limit = 3 } = block;

  const { data: businesses = [], isLoading } = useQuery<BusinessItem[]>({
    queryKey: ['blocks', 'directory', limit],
    queryFn: async () => {
      const { data } = await api.get('/directory/businesses', { params: { promoted: true, limit } });
      return data ?? [];
    }
  });

  return (
    <section className="px-4 py-16 md:px-6">
      <div className="mx-auto max-w-7xl">
        <div className="mb-8 flex items-end justify-between">
          <div>{title && <h2 className="section-title">{title}</h2>}</div>
          <SmartLink href="/directory" className="hidden text-sm font-semibold text-neon-blue sm:inline-flex">
            View all <ArrowRight className="ml-1 h-4 w-4" />
          </SmartLink>
        </div>

        {isLoading ? (
          <div className="grid gap-6 md:grid-cols-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="glass-card h-48 animate-pulse" />
            ))}
          </div>
        ) : businesses.length === 0 ? (
          <p className="text-slate-600 dark:text-slate-400">No businesses right now.</p>
        ) : (
          <div className="grid gap-6 md:grid-cols-3">
            {businesses.slice(0, limit).map((business, index) => (
              <motion.div
                key={business.id}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.05 }}
              >
                <SmartLink href={`/directory/${business.id}`}>
                  <div className="glass-card flex h-full flex-col p-6">
                    <div className="flex items-start justify-between">
                      {business.logoUrl ? (
                        <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-white p-1.5 dark:border-white/10">
                          <img
                            src={business.logoUrl}
                            alt={business.businessName}
                            className="h-full w-full object-contain"
                          />
                        </div>
                      ) : (
                        <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-neon-gold to-amber-500">
                          <span className="text-sm font-bold text-amber-950">
                            {business.businessName.charAt(0).toUpperCase()}
                          </span>
                        </div>
                      )}
                      {business.isPromoted && (
                        <span className="rounded-full bg-neon-gold/20 px-2 py-1 text-xs font-medium text-amber-900 dark:bg-neon-gold/10 dark:text-neon-gold">
                          Featured
                        </span>
                      )}
                    </div>
                    <h3 className="mt-4 text-lg font-bold">{business.businessName}</h3>
                    <p className="mt-1 line-clamp-2 flex-1 text-sm text-slate-700 dark:text-slate-400">
                      {business.description ?? business.category ?? 'Sri Lankan business in Kent'}
                    </p>
                  </div>
                </SmartLink>
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
