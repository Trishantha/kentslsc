'use client';

import { useParams } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Loader2, CheckCircle } from 'lucide-react';
import { api } from '@/lib/api';
import { cn, formatDateTime } from '@/lib/utils';
import type { ContactMessage } from '../../types';

const statuses = ['NEW', 'IN_PROGRESS', 'RESOLVED'];

export default function ContactStatusPage() {
  const { id } = useParams<{ id: string }>();
  const queryClient = useQueryClient();

  const { data: message, isLoading } = useQuery<ContactMessage>({
    queryKey: ['admin', 'contact-messages', id],
    queryFn: async () => {
      const res = await api.get(`/admin/contact-messages/${id}`);
      return res.data;
    },
    enabled: !!id
  });

  const statusMutation = useMutation({
    mutationFn: async ({ messageId, status }: { messageId: string; status: string }) => {
      const res = await api.put(`/admin/contact-messages/${messageId}/status`, { status });
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'contact-messages'] });
      queryClient.invalidateQueries({ queryKey: ['admin', 'contact-messages', id] });
    }
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
      <div className="glass-card p-5">
        <h3 className="mb-4 text-lg font-semibold">Update Status</h3>
        <p className="mb-4 text-sm text-slate-500">
          Current status: <span className="font-medium text-slate-300">{message.handledStatus}</span>
        </p>
        <div className="flex flex-wrap gap-2">
          {statuses.map((status) => (
            <button
              key={status}
              type="button"
              onClick={() => statusMutation.mutate({ messageId: id, status })}
              disabled={message.handledStatus === status || statusMutation.isPending}
              className={cn(
                'inline-flex items-center gap-1 rounded-lg px-3 py-2 text-xs font-semibold transition-colors',
                message.handledStatus === status
                  ? 'bg-neon-blue/20 text-neon-blue'
                  : 'bg-white/5 text-slate-300 hover:bg-white/10'
              )}
            >
              {message.handledStatus === status && <CheckCircle className="h-3 w-3" />}
              {status}
            </button>
          ))}
        </div>
        <p className="mt-6 text-xs text-slate-500">Received {formatDateTime(message.createdAt)}</p>
      </div>
    </div>
  );
}
