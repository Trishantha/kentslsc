'use client';

import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { Plus, Loader2, Users, Eye } from 'lucide-react';
import Link from 'next/link';
import { api } from '@/lib/api';
import { AdminListLayout } from '@/components/admin/AdminListLayout';

export interface AdminCommitteeMember {
  id: string;
  name: string;
  position: string;
  roleKey: string;
  photoUrl: string | null;
  displayOrder: number;
}

export default function AdminCommitteePage() {
  const { data, isLoading, error } = useQuery<AdminCommitteeMember[]>({
    queryKey: ['admin', 'committee'],
    queryFn: async () => {
      const res = await api.get('/admin/committee');
      return res.data;
    }
  });

  return (
    <AdminListLayout
      title="Committee"
      description="Manage committee member name, position, role key, and photo."
      action={
        <Link
          href="/admin/committee/new"
          className="btn-primary inline-flex items-center gap-2"
        >
          <Plus className="h-4 w-4" />
          New member
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
            <p>Failed to load committee members. {(error as Error).message}</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-white/10 text-slate-500 dark:text-slate-400">
                  <th className="py-3 font-medium">Member</th>
                  <th className="py-3 font-medium">Role key</th>
                  <th className="py-3 font-medium">Order</th>
                  <th className="py-3 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {data?.map((member, idx) => (
                  <motion.tr
                    key={member.id}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: idx * 0.03 }}
                  >
                    <td className="py-3">
                      <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-full bg-white/10 text-slate-400">
                          {member.photoUrl ? (
                            <img
                              src={member.photoUrl}
                              alt={member.name}
                              className="h-full w-full object-cover"
                            />
                          ) : (
                            <Users className="h-4 w-4" />
                          )}
                        </div>
                        <div>
                          <div className="font-medium">{member.name}</div>
                          <div className="text-xs text-slate-500">{member.position}</div>
                        </div>
                      </div>
                    </td>
                    <td className="py-3 text-slate-600 dark:text-slate-400">{member.roleKey}</td>
                    <td className="py-3">{member.displayOrder}</td>
                    <td className="py-3">
                      <div className="flex justify-end">
                        <Link
                          href={`/admin/committee/${member.id}/details`}
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

            {!data?.length && (
              <div className="mt-8 text-center text-slate-500">No committee members yet.</div>
            )}
          </div>
        )}
      </div>
    </AdminListLayout>
  );
}
