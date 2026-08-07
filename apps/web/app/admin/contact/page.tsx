'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { Loader2, Mail, CheckCircle } from 'lucide-react';
import { api } from '@/lib/api';

interface ContactMessage {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  subject: string;
  message: string;
  handledStatus: string;
  createdAt: string;
}

const statuses = ['NEW', 'IN_PROGRESS', 'RESOLVED'];

export default function AdminContactPage() {
  const [selected, setSelected] = useState<ContactMessage | null>(null);
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery<ContactMessage[]>({
    queryKey: ['admin', 'contact-messages'],
    queryFn: async () => {
      const res = await api.get('/admin/contact-messages');
      return res.data;
    }
  });

  const statusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const res = await api.put(`/admin/contact-messages/${id}/status`, { status });
      return res.data;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin', 'contact-messages'] })
  });

  return (
    <div>
      <h1 className="section-title">Contact Messages</h1>
      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <div className="glass-card p-6 lg:col-span-1">
          <h2 className="mb-4 text-lg font-bold">Inbox</h2>
          {isLoading ? (
            <div className="flex h-40 items-center justify-center">
              <Loader2 className="h-6 w-6 animate-spin text-neon-blue" />
            </div>
          ) : (
            <div className="max-h-[70vh] space-y-3 overflow-y-auto pr-2">
              {data?.map((msg, idx) => (
                <motion.button
                  key={msg.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: idx * 0.03 }}
                  onClick={() => setSelected(msg)}
                  className={`w-full rounded-xl border p-4 text-left transition-colors ${
                    selected?.id === msg.id
                      ? 'border-neon-blue bg-neon-blue/10'
                      : 'border-white/10 bg-white/5 hover:bg-white/10'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <Mail className="h-4 w-4 text-neon-blue" />
                    <span className="truncate font-medium">{msg.subject}</span>
                  </div>
                  <div className="mt-1 truncate text-xs text-slate-500">{msg.name} · {msg.email}</div>
                  <div className="mt-2 flex items-center gap-2">
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
                  </div>
                </motion.button>
              ))}
              {!data?.length && <div className="text-center text-slate-500">No messages.</div>}
            </div>
          )}
        </div>

        <div className="glass-card p-6 lg:col-span-2">
          {selected ? (
            <div>
              <div className="mb-4 flex items-start justify-between gap-4">
                <div>
                  <h2 className="text-xl font-bold">{selected.subject}</h2>
                  <p className="mt-1 text-sm text-slate-500">
                    From {selected.name} ({selected.email}) {selected.phone && `· ${selected.phone}`}
                  </p>
                </div>
                <span
                  className={`rounded-full px-3 py-1 text-xs font-semibold ${
                    selected.handledStatus === 'RESOLVED'
                      ? 'bg-green-500/10 text-green-400'
                      : selected.handledStatus === 'IN_PROGRESS'
                        ? 'bg-yellow-500/10 text-yellow-400'
                        : 'bg-slate-500/10 text-slate-400'
                  }`}
                >
                  {selected.handledStatus}
                </span>
              </div>
              <div className="rounded-xl border border-white/10 bg-white/5 p-4 text-sm leading-relaxed text-slate-700 dark:text-slate-300">
                {selected.message}
              </div>
              <div className="mt-6">
                <label className="mb-2 block text-sm font-medium text-slate-600 dark:text-slate-400">Update status</label>
                <div className="flex flex-wrap gap-2">
                  {statuses.map((status) => (
                    <button
                      key={status}
                      type="button"
                      onClick={() => statusMutation.mutate({ id: selected.id, status })}
                      disabled={selected.handledStatus === status || statusMutation.isPending}
                      className={`inline-flex items-center gap-1 rounded-lg px-3 py-2 text-xs font-semibold transition-colors ${
                        selected.handledStatus === status
                          ? 'bg-neon-blue/20 text-neon-blue'
                          : 'bg-white/5 text-slate-300 hover:bg-white/10'
                      }`}
                    >
                      {selected.handledStatus === status && <CheckCircle className="h-3 w-3" />}
                      {status}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div className="flex h-64 flex-col items-center justify-center text-slate-500">
              <Mail className="mb-3 h-10 w-10 opacity-50" />
              <p>Select a message to view details</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
