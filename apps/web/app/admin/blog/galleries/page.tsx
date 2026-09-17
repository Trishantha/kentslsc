'use client';

import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { Plus, Loader2, Images, Upload, Pencil } from 'lucide-react';
import Link from 'next/link';
import { api } from '@/lib/api';
import { AdminListLayout } from '@/components/admin/AdminListLayout';
import { formatDate } from '@/lib/utils';
import type { AdminGallery } from './types';

export default function AdminGalleriesPage() {
  const { data: galleries, isLoading, error } = useQuery<AdminGallery[]>({
    queryKey: ['admin', 'galleries'],
    queryFn: async () => {
      const res = await api.get('/galleries/admin/all');
      return res.data;
    }
  });

  return (
    <AdminListLayout
      title="Event Galleries"
      description="Create and manage photo galleries for events."
      action={
        <Link
          href="/admin/blog/galleries/new"
          className="btn-primary inline-flex items-center gap-2"
        >
          <Plus className="h-4 w-4" />
          New gallery
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
            <p>Failed to load galleries. {(error as Error).message}</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-white/10 text-slate-500 dark:text-slate-400">
                  <th className="px-4 py-3 font-medium">Title</th>
                  <th className="px-4 py-3 font-medium">Event date</th>
                  <th className="px-4 py-3 font-medium">Published</th>
                  <th className="px-4 py-3 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {galleries?.map((gallery, idx) => (
                  <motion.tr
                    key={gallery.id}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: idx * 0.03 }}
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <Images className="h-4 w-4 text-neon-purple" />
                        <div>
                          <Link
                            href={`/admin/blog/galleries/${gallery.id}/photos`}
                            className="font-medium hover:text-neon-blue"
                          >
                            {gallery.title}
                          </Link>
                          <p className="text-xs text-slate-500">/{gallery.slug}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-slate-600 dark:text-slate-400">
                      {gallery.eventDate
                        ? formatDate(gallery.eventDate)
                        : '—'}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                          gallery.isPublished
                            ? 'bg-green-500/10 text-green-400'
                            : 'bg-slate-500/10 text-slate-400'
                        }`}
                      >
                        {gallery.isPublished ? 'Published' : 'Draft'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap justify-end gap-2">
                        <Link
                          href={`/admin/blog/galleries/${gallery.id}/photos`}
                          className="inline-flex items-center gap-1.5 rounded-lg bg-neon-blue/10 px-3 py-1.5 text-neon-blue hover:bg-neon-blue/20"
                        >
                          <Upload className="h-4 w-4" />
                          Upload photos
                        </Link>
                        <Link
                          href={`/admin/blog/galleries/${gallery.id}/content`}
                          className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-sm font-medium hover:bg-white/10"
                        >
                          <Pencil className="h-4 w-4" />
                          Edit
                        </Link>
                      </div>
                    </td>
                  </motion.tr>
                ))}
              </tbody>
            </table>
            {!galleries?.length && (
              <div className="mt-8 text-center text-slate-500">No galleries yet.</div>
            )}
          </div>
        )}
      </div>
    </AdminListLayout>
  );
}
