'use client';

import { useParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { Loader2 } from 'lucide-react';
import { api } from '@/lib/api';
import { formatDateTime } from '@/lib/utils';
import type { ContactMessage } from '../../types';

export default function ContactMessagePage() {
  const { id } = useParams<{ id: string }>();

  const { data: message, isLoading } = useQuery<ContactMessage>({
    queryKey: ['admin', 'contact-messages', id],
    queryFn: async () => {
      const res = await api.get(`/admin/contact-messages/${id}`);
      return res.data;
    },
    enabled: !!id
  });

  if (isLoading || !message) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-neon-blue" />
      </div>
    );
  }

  return (
    <div className="max-w-3xl">
      <div className="glass-card space-y-4 p-5">
        <div className="grid gap-4 text-sm sm:grid-cols-2">
          <div>
            <span className="text-slate-500">From</span>
            <p className="font-medium">{message.name}</p>
          </div>
          <div>
            <span className="text-slate-500">Email</span>
            <p className="font-medium">{message.email}</p>
          </div>
          {message.phone && (
            <div>
              <span className="text-slate-500">Phone</span>
              <p className="font-medium">{message.phone}</p>
            </div>
          )}
          <div>
            <span className="text-slate-500">Received</span>
            <p className="font-medium">{formatDateTime(message.createdAt)}</p>
          </div>
        </div>
        <div className="rounded-xl border border-white/10 bg-white/5 p-4 text-sm leading-relaxed text-slate-700 dark:text-slate-300">
          {message.message}
        </div>
      </div>
    </div>
  );
}
