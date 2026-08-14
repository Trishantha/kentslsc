'use client';

import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { Plus, Loader2, Newspaper, Eye } from 'lucide-react';
import Link from 'next/link';
import { api } from '@/lib/api';
import { AdminListLayout } from '@/components/admin/AdminListLayout';
import type { AdminBlogPost } from './types';

export default function AdminBlogPage() {
  const { data: posts, isLoading, error } = useQuery<AdminBlogPost[]>({
    queryKey: ['admin', 'blog'],
    queryFn: async () => {
      const res = await api.get('/admin/blog/posts');
      return res.data;
    }
  });

  return (
    <AdminListLayout
      title="Blog Posts"
      description="Create and manage blog posts, SEO settings and previews."
      action={
        <Link
          href="/admin/blog/new"
          className="btn-primary inline-flex items-center gap-2"
        >
          <Plus className="h-4 w-4" />
          New post
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
            <p>Failed to load blog posts. {(error as Error).message}</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-white/10 text-slate-500 dark:text-slate-400">
                  <th className="px-4 py-3 font-medium">Title</th>
                  <th className="px-4 py-3 font-medium">Author</th>
                  <th className="px-4 py-3 font-medium">Published</th>
                  <th className="px-4 py-3 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {posts?.map((post, idx) => (
                  <motion.tr
                    key={post.id}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: idx * 0.03 }}
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <Newspaper className="h-4 w-4 text-neon-purple" />
                        <div>
                          <Link
                            href={`/admin/blog/${post.id}/content`}
                            className="font-medium hover:text-neon-blue"
                          >
                            {post.title}
                          </Link>
                          <p className="text-xs text-slate-500">/{post.slug}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-slate-600 dark:text-slate-400">
                      {post.author.name}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                          post.isPublished
                            ? 'bg-green-500/10 text-green-400'
                            : 'bg-slate-500/10 text-slate-400'
                        }`}
                      >
                        {post.isPublished ? 'Published' : 'Draft'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end">
                        <Link
                          href={`/admin/blog/${post.id}/content`}
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
            {!posts?.length && (
              <div className="mt-8 text-center text-slate-500">No posts yet.</div>
            )}
          </div>
        )}
      </div>
    </AdminListLayout>
  );
}
