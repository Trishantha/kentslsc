'use client';

import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { Plus, Loader2, Eye, X, Check, PauseCircle } from 'lucide-react';
import Link from 'next/link';
import { api } from '@/lib/api';
import { AdminListLayout } from '@/components/admin/AdminListLayout';
import { membershipFeatureLabels } from '@kentslsc/shared';
import type { AdminMembershipType } from './types';

export default function AdminMembershipTypesPage() {
  const { data, isLoading, error } = useQuery<AdminMembershipType[]>({
    queryKey: ['admin', 'membership-types'],
    queryFn: async () => {
      const res = await api.get('/membership/types?includePaused=true');
      return res.data;
    }
  });

  return (
    <AdminListLayout
      title="Membership Types"
      description="Create and manage membership tiers, pricing, and included features."
      action={
        <Link href="/admin/membership-types/new" className="btn-primary inline-flex items-center gap-2">
          <Plus className="h-4 w-4" />
          New type
        </Link>
      }
    >
      <div className="glass-card p-6">
        {isLoading ? (
          <div className="flex h-40 items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-neon-blue" />
          </div>
        ) : error ? (
          <div className="flex h-40 items-center justify-center text-red-400">
            <p>Failed to load membership types. {(error as Error).message}</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-white/10 text-slate-500 dark:text-slate-400">
                  <th className="py-3 font-medium">Name</th>
                  <th className="py-3 font-medium">Price</th>
                  <th className="py-3 font-medium">Duration</th>
                  <th className="py-3 font-medium">Limit</th>
                  <th className="py-3 font-medium">Issued</th>
                  <th className="py-3 font-medium">Features</th>
                  <th className="py-3 font-medium">Auto-activate</th>
                  <th className="py-3 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {data?.map((type, idx) => (
                  <motion.tr
                    key={type.id}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: idx * 0.03 }}
                    className={type.isPaused ? 'opacity-60' : ''}
                  >
                    <td className="py-3">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{type.name}</span>
                        {type.isPaused && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 px-2 py-0.5 text-xs font-medium text-amber-400">
                            <PauseCircle className="h-3 w-3" />
                            Paused
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-slate-500">{type.description}</div>
                    </td>
                    <td className="py-3">{type.isFree || type.price === 0 ? 'Free' : `£${type.price}`}</td>
                    <td className="py-3">
                      {type.isFree ? 'Lifetime' : `${type.durationMonths} months`}
                    </td>
                    <td className="py-3">{type.maxIssuances ?? 'Unlimited'}</td>
                    <td className="py-3">
                      <span className={type.hasCapacity === false ? 'text-red-400' : ''}>
                        {type.issuedCount ?? 0}
                      </span>
                    </td>
                    <td className="py-3">
                      <div className="flex max-w-xs flex-wrap gap-1">
                        {type.features.map((feature) => (
                          <span key={feature} className="rounded-full bg-neon-blue/10 px-2 py-0.5 text-xs text-neon-blue">
                            {membershipFeatureLabels[feature]?.label ?? feature}
                          </span>
                        ))}
                        {type.features.length === 0 && <span className="text-slate-500">None</span>}
                      </div>
                    </td>
                    <td className="py-3">
                      {type.autoActivate ? (
                        <span className="inline-flex items-center gap-1 text-xs text-green-400"><Check className="h-3 w-3" /> Yes</span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-xs text-slate-500"><X className="h-3 w-3" /> No</span>
                      )}
                    </td>
                    <td className="py-3">
                      <div className="flex justify-end">
                        <Link
                          href={`/admin/membership-types/${type.id}/details`}
                          className="inline-flex items-center gap-1.5 rounded-lg bg-neon-blue/10 px-3 py-1.5 text-neon-blue hover:bg-neon-blue/20"
                        >
                          <Eye className="h-4 w-4" />
                          View
                        </Link>
                      </div>
                    </td>
                  </motion.tr>
                ))}
              </tbody>
            </table>
            {!data?.length && <div className="mt-8 text-center text-slate-500">No membership types found.</div>}
          </div>
        )}
      </div>
    </AdminListLayout>
  );
}
