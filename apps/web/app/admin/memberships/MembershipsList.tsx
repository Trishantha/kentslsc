'use client';

import Link from 'next/link';
import { motion } from 'framer-motion';
import { Eye } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { AdminMembership } from './types';

interface MembershipsListProps {
  memberships: AdminMembership[];
}

export function MembershipsList({ memberships }: MembershipsListProps) {
  return (
    <div className="glass-card overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-white/10 text-slate-500 dark:text-slate-400">
              <th className="px-4 py-3 font-medium">Member</th>
              <th className="px-4 py-3 font-medium">Type</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium">Dates</th>
              <th className="px-4 py-3 font-medium text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {memberships.map((m, idx) => (
              <motion.tr
                key={m.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.03 }}
                className="group"
              >
                <td className="px-4 py-3">
                  <Link
                    href={`/admin/memberships/${m.id}/details`}
                    className="font-medium hover:text-neon-blue"
                  >
                    {m.user.name}
                  </Link>
                  <div className="text-xs text-slate-500">{m.user.email}</div>
                </td>
                <td className="px-4 py-3 text-slate-600 dark:text-slate-400">
                  {m.membershipType.name}
                </td>
                <td className="px-4 py-3">
                  <span
                    className={cn(
                      'rounded-full px-2 py-0.5 text-xs font-semibold',
                      m.status === 'ACTIVE'
                        ? 'bg-green-500/10 text-green-400'
                        : m.status === 'PENDING'
                          ? 'bg-yellow-500/10 text-yellow-400'
                          : 'bg-red-500/10 text-red-400'
                    )}
                  >
                    {m.status}
                  </span>
                </td>
                <td className="px-4 py-3 text-slate-600 dark:text-slate-400">
                  {m.startDate && m.endDate
                    ? `${new Date(m.startDate).toLocaleDateString('en-GB')} – ${new Date(m.endDate).toLocaleDateString('en-GB')}`
                    : '-'}
                </td>
                <td className="px-4 py-3">
                  <div className="flex justify-end gap-2">
                    <Link
                      href={`/admin/memberships/${m.id}/details`}
                      className="rounded-lg bg-neon-blue/10 p-2 text-neon-blue hover:bg-neon-blue/20"
                      title="View details"
                    >
                      <Eye className="h-4 w-4" />
                    </Link>
                  </div>
                </td>
              </motion.tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
