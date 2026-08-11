'use client';

import { useEffect, useState } from 'react';
import { Loader2, Megaphone } from 'lucide-react';
import { api } from '@/lib/api';
import { RichTextContent } from '@/components/ui/RichTextContent';

interface Update {
  id: string;
  title: string;
  content: string;
  createdAt: string;
  author: { name: string; firstName?: string | null; lastName?: string | null };
}

interface Props {
  fundraiserId: string;
}

export function FundraiserUpdates({ fundraiserId }: Props) {
  const [updates, setUpdates] = useState<Update[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .get(`/fundraisers/${fundraiserId}/updates`)
      .then((res) => setUpdates(res.data))
      .finally(() => setLoading(false));
  }, [fundraiserId]);

  if (loading) {
    return (
      <div className="flex justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-neon-blue" />
      </div>
    );
  }

  if (updates.length === 0) {
    return (
      <p className="py-8 text-center text-slate-400">No updates yet.</p>
    );
  }

  return (
    <ul className="space-y-4">
      {updates.map((u) => (
        <li key={u.id} className="rounded-xl border border-slate-100 bg-white p-5 dark:border-slate-700 dark:bg-slate-800/50">
          <div className="mb-2 flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-full bg-neon-blue/20">
              <Megaphone className="h-3.5 w-3.5 text-neon-blue" />
            </div>
            <div>
              <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">{u.title}</p>
              <p className="text-xs text-slate-400">
                {u.author.firstName ?? u.author.name} · {new Date(u.createdAt).toLocaleDateString()}
              </p>
            </div>
          </div>
          <RichTextContent html={u.content} className="text-sm text-slate-600 dark:text-slate-400" />
        </li>
      ))}
    </ul>
  );
}
