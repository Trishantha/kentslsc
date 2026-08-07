'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { Loader2, CheckCircle, XCircle, RefreshCw } from 'lucide-react';
import { api } from '@/lib/api';

interface Membership {
  id: string;
  membershipId: string;
  status: string;
  startDate: string | null;
  endDate: string | null;
  createdAt: string;
  user: { id: string; name: string; email: string };
  membershipType: { name: string };
}

export default function AdminMembershipsPage() {
  const [status, setStatus] = useState('PENDING');
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery<{ items: Membership[]; total: number }>({
    queryKey: ['admin', 'memberships', status],
    queryFn: async () => {
      const params = new URLSearchParams({ page: '1', limit: '100' });
      if (status !== 'ALL') params.append('status', status);
      const res = await api.get(`/admin/memberships?${params.toString()}`);
      return res.data;
    }
  });

  const statusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const res = await api.put(`/admin/memberships/${id}/status`, { status });
      return res.data;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin', 'memberships'] })
  });

  const regenerateMutation = useMutation({
    mutationFn: async (membershipId: string) => {
      const res = await api.post(`/admin/memberships/${membershipId}/regenerate-card`);
      return res.data;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin', 'memberships'] })
  });

  return (
    <div>
      <h1 className="section-title">Memberships</h1>
      <div className="mt-6 glass-card p-6">
        <div className="mb-4">
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-slate-900 outline-none focus:border-neon-blue dark:text-slate-100"
          >
            <option value="ALL">All statuses</option>
            <option value="PENDING">Pending</option>
            <option value="ACTIVE">Active</option>
            <option value="EXPIRED">Expired</option>
            <option value="CANCELLED">Cancelled</option>
          </select>
        </div>

        {isLoading ? (
          <div className="flex h-40 items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-neon-blue" />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-white/10 text-slate-500 dark:text-slate-400">
                  <th className="py-3 font-medium">Member</th>
                  <th className="py-3 font-medium">Type</th>
                  <th className="py-3 font-medium">Status</th>
                  <th className="py-3 font-medium">Dates</th>
                  <th className="py-3 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {data?.items.map((m, idx) => (
                  <motion.tr
                    key={m.id}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: idx * 0.03 }}
                  >
                    <td className="py-3">
                      <div className="font-medium">{m.user.name}</div>
                      <div className="text-xs text-slate-500">{m.user.email}</div>
                    </td>
                    <td className="py-3">{m.membershipType.name}</td>
                    <td className="py-3">
                      <span
                        className={`rounded-full px-2 py-1 text-xs font-semibold ${
                          m.status === 'ACTIVE'
                            ? 'bg-green-500/10 text-green-400'
                            : m.status === 'PENDING'
                              ? 'bg-yellow-500/10 text-yellow-400'
                              : 'bg-red-500/10 text-red-400'
                        }`}
                      >
                        {m.status}
                      </span>
                    </td>
                    <td className="py-3 text-slate-600 dark:text-slate-400">
                      {m.startDate && m.endDate
                        ? `${new Date(m.startDate).toLocaleDateString('en-GB')} – ${new Date(m.endDate).toLocaleDateString('en-GB')}`
                        : '-'}
                    </td>
                    <td className="py-3">
                      <div className="flex flex-wrap gap-2">
                        {m.status === 'PENDING' && (
                          <>
                            <button
                              type="button"
                              onClick={() => statusMutation.mutate({ id: m.id, status: 'ACTIVE' })}
                              className="inline-flex items-center gap-1 rounded-lg bg-green-500/10 px-2 py-1 text-xs font-semibold text-green-400 hover:bg-green-500/20"
                            >
                              <CheckCircle className="h-3 w-3" /> Approve
                            </button>
                            <button
                              type="button"
                              onClick={() => statusMutation.mutate({ id: m.id, status: 'CANCELLED' })}
                              className="inline-flex items-center gap-1 rounded-lg bg-red-500/10 px-2 py-1 text-xs font-semibold text-red-400 hover:bg-red-500/20"
                            >
                              <XCircle className="h-3 w-3" /> Reject
                            </button>
                          </>
                        )}
                        <button
                          type="button"
                          onClick={() => regenerateMutation.mutate(m.membershipId)}
                          className="inline-flex items-center gap-1 rounded-lg bg-neon-blue/10 px-2 py-1 text-xs font-semibold text-neon-blue hover:bg-neon-blue/20"
                        >
                          <RefreshCw className="h-3 w-3" /> Card
                        </button>
                      </div>
                    </td>
                  </motion.tr>
                ))}
              </tbody>
            </table>
            {!data?.items.length && (
              <div className="mt-8 text-center text-slate-500">No memberships found.</div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
