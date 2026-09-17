'use client';

import Link from 'next/link';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Pencil, Trash2, Loader2, Home, Eye, EyeOff } from 'lucide-react';
import { api } from '@/lib/api';
import { formatDate } from '@/lib/utils';

interface SitePage {
  id: string;
  slug: string;
  title: string;
  isHome: boolean;
  isPublished: boolean;
  updatedAt: string;
}

export default function AdminPagesPage() {
  const queryClient = useQueryClient();
  const { data, isLoading } = useQuery<SitePage[]>({
    queryKey: ['admin', 'pages'],
    queryFn: async () => {
      const res = await api.get('/pages/admin/all');
      return res.data;
    }
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/pages/admin/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'pages'] });
    }
  });

  return (
    <div>
      <div className="flex items-center justify-between">
        <h1 className="section-title">Pages</h1>
        <Link href="/admin/pages/new" className="btn-primary text-sm">
          <Plus className="mr-2 h-4 w-4" /> New page
        </Link>
      </div>
      <p className="mt-2 text-slate-600 dark:text-slate-400">
        Build and publish drag-and-drop pages for the site.
      </p>

      <div className="mt-8 glass-card overflow-hidden">
        {isLoading ? (
          <div className="flex h-40 items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-neon-blue" />
          </div>
        ) : (
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-white/10 text-slate-500 dark:text-slate-400">
                <th className="px-6 py-3 font-medium">Title</th>
                <th className="px-6 py-3 font-medium">Slug</th>
                <th className="px-6 py-3 font-medium">Status</th>
                <th className="px-6 py-3 font-medium">Updated</th>
                <th className="px-6 py-3 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {data?.map((page) => (
                <tr key={page.id}>
                  <td className="px-6 py-4 font-medium">
                    <div className="flex items-center gap-2">
                      {page.title}
                      {page.isHome && (
                        <span className="rounded-full bg-neon-gold/10 px-2 py-0.5 text-xs text-amber-700 dark:text-neon-gold">
                          <Home className="mr-1 inline h-3 w-3" /> Home
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4 text-slate-600 dark:text-slate-400">/{page.slug}</td>
                  <td className="px-6 py-4">
                    {page.isPublished ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-green-500/10 px-2 py-1 text-xs text-green-400">
                        <Eye className="h-3 w-3" /> Published
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 rounded-full bg-slate-500/10 px-2 py-1 text-xs text-slate-400">
                        <EyeOff className="h-3 w-3" /> Draft
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-4 text-slate-600 dark:text-slate-400">
                    {formatDate(page.updatedAt)}
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex gap-2">
                      <Link
                        href={`/admin/pages/${page.id}`}
                        className="rounded-lg bg-neon-blue/10 p-2 text-neon-blue hover:bg-neon-blue/20"
                      >
                        <Pencil className="h-4 w-4" />
                      </Link>
                      <button
                        type="button"
                        onClick={() => deleteMutation.mutate(page.id)}
                        className="rounded-lg bg-red-500/10 p-2 text-red-400 hover:bg-red-500/20"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {!isLoading && data?.length === 0 && (
          <div className="p-8 text-center text-slate-500">No pages yet. Create your first page.</div>
        )}
      </div>
    </div>
  );
}
