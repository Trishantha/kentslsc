'use client';

import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { Loader2, Eye } from 'lucide-react';
import Link from 'next/link';
import { api } from '@/lib/api';
import { AdminListLayout } from '@/components/admin/AdminListLayout';
import { formatDate } from '@/lib/utils';
import type { ContactMessage } from './types';

export default function AdminContactPage() {
  const { data, isLoading } = useQuery<ContactMessage[]>({
    queryKey: ['admin', 'contact-messages'],
    queryFn: async () => {
      const res = await api.get('/admin/contact-messages');
      return res.data;
    }
  });

  return (
    <AdminListLayout
      title="Contact Messages"
      description="Review and manage inbound contact messages."
    >
      <div className="glass-card p-6">
        {isLoading ? (
          <div className="flex h-40 items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-neon-blue" />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-white/10 text-slate-500 dark:text-slate-400">
                  <th className="py-3 font-medium">Subject</th>
                  <th className="py-3 font-medium">From</th>
                  <th className="py-3 font-medium">Status</th>
                  <th className="py-3 font-medium">Received</th>
                  <th className="py-3 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {data?.map((msg, idx) => (
                  <motion.tr
                    key={msg.id}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: idx * 0.03 }}
                  >
                    <td className="py-3 font-medium">{msg.subject}</td>
                    <td className="py-3 text-slate-600 dark:text-slate-400">
                      {msg.name} · {msg.email}
                    </td>
                    <td className="py-3">
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                          msg.handledStatus === 'RESOLVED'
                            ? 'bg-green-500/10 text-green-400'
                            : msg.handledStatus === 'IN_PROGRESS'
                              ? 'bg-yellow-500/10 text-yellow-400'
                              : 'bg-slate-500/10 text-slate-400'
                        }`}
                      >
                        {msg.handledStatus}
                      </span>
                    </td>
                    <td className="py-3 text-slate-600 dark:text-slate-400">
                      {formatDate(msg.createdAt)}
                    </td>
                    <td className="py-3">
                      <div className="flex justify-end">
                        <Link
                          href={`/admin/contact/${msg.id}/message`}
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
              <div className="mt-8 text-center text-slate-500">No messages.</div>
            )}
          </div>
        )}
      </div>
    </AdminListLayout>
  );
}
