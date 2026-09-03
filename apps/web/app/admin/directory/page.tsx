'use client';

import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { Plus, Loader2, Building2, Eye, Search } from 'lucide-react';
import Link from 'next/link';
import { api } from '@/lib/api';
import { AdminListLayout } from '@/components/admin/AdminListLayout';
import { getDirectoryCategoryLabel } from '@kentslsc/shared';
import type { AdminBusiness } from './types';

export default function AdminDirectoryPage() {
  const [search, setSearch] = useState('');

  const { data, isLoading, error } = useQuery<AdminBusiness[]>({
    queryKey: ['admin', 'businesses'],
    queryFn: async () => {
      const res = await api.get('/admin/directory/businesses');
      return res.data;
    }
  });

  const stats = useMemo(() => {
    if (!data) return null;
    const total = data.length;
    const paid = data.filter((b) => b.isPaid).length;
    const promoted = data.filter((b) => b.isPromoted).length;
    return { total, paid, promoted };
  }, [data]);

  const filtered = useMemo(() => {
    if (!data) return [];
    const q = search.trim().toLowerCase();
    if (!q) return data;
    return data.filter(
      (b) =>
        b.businessName.toLowerCase().includes(q) ||
        (b.category?.toLowerCase().includes(q) ?? false) ||
        (b.email?.toLowerCase().includes(q) ?? false)
    );
  }, [data, search]);

  return (
    <AdminListLayout
      title="Directory"
      description="Manage business listings, jobs and media."
      action={
        <Link
          href="/admin/directory/new"
          className="btn-primary inline-flex items-center gap-2"
        >
          <Plus className="h-4 w-4" />
          New listing
        </Link>
      }
    >
      {stats && (
        <div className="grid gap-4 sm:grid-cols-3">
          {[
            { label: 'Total Listings', value: stats.total, icon: <Building2 className="h-5 w-5 text-neon-blue" /> },
            { label: 'Paid Listings', value: stats.paid, icon: <Building2 className="h-5 w-5 text-neon-gold" /> },
            { label: 'Featured', value: stats.promoted, icon: <Building2 className="h-5 w-5 text-green-400" /> }
          ].map((s) => (
            <div key={s.label} className="glass-card flex items-center gap-3 p-4">
              {s.icon}
              <div>
                <p className="text-xl font-bold">{s.value}</p>
                <p className="text-xs text-slate-500 dark:text-slate-400">{s.label}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="glass-card mt-6 p-6">
        <div className="mb-4 flex items-center gap-3">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search listings..."
              className="w-full rounded-xl border border-white/10 bg-white/5 py-2 pl-9 pr-4 text-sm outline-none focus:border-neon-blue"
            />
          </div>
        </div>

        {isLoading ? (
          <div className="flex h-40 items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-neon-blue" />
          </div>
        ) : error ? (
          <div className="flex h-40 items-center justify-center text-red-400">
            <p>Failed to load listings. {(error as Error).message}</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-white/10 text-slate-500 dark:text-slate-400">
                  <th className="px-4 py-3 font-medium">Business</th>
                  <th className="px-4 py-3 font-medium">Category</th>
                  <th className="px-4 py-3 font-medium">Paid</th>
                  <th className="px-4 py-3 font-medium">Featured</th>
                  <th className="px-4 py-3 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {filtered.map((business, idx) => (
                  <motion.tr
                    key={business.id}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: idx * 0.03 }}
                    className="group"
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        {business.logoUrl ? (
                          <img
                            src={business.logoUrl}
                            alt=""
                            className="h-8 w-8 rounded-full object-cover"
                          />
                        ) : (
                          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-neon-blue/10 text-neon-blue">
                            <Building2 className="h-4 w-4" />
                          </div>
                        )}
                        <div>
                          <Link
                            href={`/admin/directory/${business.id}/details`}
                            className="font-medium hover:text-neon-blue"
                          >
                            {business.businessName}
                          </Link>
                          <div className="text-xs text-slate-500">{business.email || '-'}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-slate-600 dark:text-slate-400">
                      {business.category ? getDirectoryCategoryLabel(business.category) : '-'}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                          business.isPaid
                            ? 'bg-green-500/10 text-green-400'
                            : 'bg-slate-500/10 text-slate-400'
                        }`}
                      >
                        {business.isPaid ? 'Yes' : 'No'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                          business.isPromoted
                            ? 'bg-neon-blue/10 text-neon-blue'
                            : 'bg-slate-500/10 text-slate-400'
                        }`}
                      >
                        {business.isPromoted ? 'Yes' : 'No'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end">
                        <Link
                          href={`/admin/directory/${business.id}/details`}
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
            {!filtered.length && (
              <div className="mt-8 text-center text-slate-500">
                {search ? 'No listings match your search.' : 'No listings yet.'}
              </div>
            )}
          </div>
        )}
      </div>
    </AdminListLayout>
  );
}
