'use client';

import { useParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { Loader2, MessageSquare, FileText } from 'lucide-react';
import { api } from '@/lib/api';
import { formatDate } from '@/lib/utils';
import type { UserDetail } from '../../types';

export default function UserForumPage() {
  const { id } = useParams<{ id: string }>();

  const { data: detail, isLoading } = useQuery<UserDetail>({
    queryKey: ['admin', 'users', id],
    queryFn: async () => {
      const res = await api.get(`/admin/users/${id}`);
      return res.data;
    },
    enabled: !!id
  });

  if (isLoading || !detail) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-neon-blue" />
      </div>
    );
  }

  return (
    <div className="max-w-3xl">
      <section className="glass-card p-5">
        <h3 className="mb-4 flex items-center gap-2 text-lg font-semibold">
          <MessageSquare className="h-5 w-5 text-neon-blue" /> Forum Activity
        </h3>
        {(detail.topics ?? []).length === 0 && (detail.posts ?? []).length === 0 ? (
          <p className="text-sm text-slate-500">No forum activity found.</p>
        ) : (
          <div className="space-y-3">
            {(detail.topics ?? []).map((t) => (
              <div key={t.id} className="rounded-xl border border-white/10 bg-white/5 p-4 text-sm">
                <div className="flex items-center gap-2">
                  <FileText className="h-4 w-4 text-slate-500" />
                  <span className="font-semibold">{t.title}</span>
                </div>
                <p className="mt-1 text-slate-500">Topic · {formatDate(t.createdAt)}</p>
              </div>
            ))}
            {(detail.posts ?? []).map((p) => (
              <div key={p.id} className="rounded-xl border border-white/10 bg-white/5 p-4 text-sm">
                <div className="line-clamp-2 text-slate-300">{p.content}</div>
                <p className="mt-1 text-slate-500">Post · {formatDate(p.createdAt)}</p>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
