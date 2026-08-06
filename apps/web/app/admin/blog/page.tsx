'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { motion } from 'framer-motion';
import { Loader2, Plus, Pencil, Trash2, X, Newspaper } from 'lucide-react';
import { api } from '@/lib/api';

const blogSchema = z.object({
  title: z.string().min(1),
  slug: z.string().min(1).regex(/^[a-z0-9-]+$/, 'Lowercase letters, numbers and hyphens only'),
  content: z.string().min(1),
  imageUrl: z.string().url().optional().or(z.literal('')),
  publishedAt: z.string().optional(),
  isPublished: z.boolean().default(false)
});

type BlogForm = z.infer<typeof blogSchema>;

interface BlogPost {
  id: string;
  title: string;
  slug: string;
  content: string;
  imageUrl: string | null;
  publishedAt: string | null;
  isPublished: boolean;
  author: { name: string };
}

export default function AdminBlogPage() {
  const [editing, setEditing] = useState<BlogPost | null>(null);
  const queryClient = useQueryClient();
  const { register, handleSubmit, reset, formState: { errors } } = useForm<BlogForm>({
    resolver: zodResolver(blogSchema)
  });

  const { data, isLoading } = useQuery<BlogPost[]>({
    queryKey: ['admin', 'blog'],
    queryFn: async () => {
      const res = await api.get('/admin/blog/posts');
      return res.data;
    }
  });

  const createMutation = useMutation({
    mutationFn: async (values: BlogForm) => {
      const res = await api.post('/admin/blog/posts', values);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'blog'] });
      reset();
    }
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, values }: { id: string; values: BlogForm }) => {
      const res = await api.put(`/admin/blog/posts/${id}`, values);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'blog'] });
      setEditing(null);
      reset();
    }
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/admin/blog/posts/${id}`);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin', 'blog'] })
  });

  const onSubmit = (values: BlogForm) => {
    const payload = { ...values, publishedAt: values.publishedAt || undefined };
    if (editing) {
      updateMutation.mutate({ id: editing.id, values: payload });
    } else {
      createMutation.mutate(payload);
    }
  };

  const startEdit = (post: BlogPost) => {
    setEditing(post);
    reset({
      title: post.title,
      slug: post.slug,
      content: post.content,
      imageUrl: post.imageUrl ?? '',
      publishedAt: post.publishedAt ? new Date(post.publishedAt).toISOString().slice(0, 16) : '',
      isPublished: post.isPublished
    });
  };

  const clearEdit = () => {
    setEditing(null);
    reset({
      title: '',
      slug: '',
      content: '',
      imageUrl: '',
      publishedAt: '',
      isPublished: false
    });
  };

  return (
    <div>
      <h1 className="section-title">Blog Posts</h1>
      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <div className="glass-card p-6 lg:col-span-1">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-bold">{editing ? 'Edit Post' : 'Create Post'}</h2>
            {editing && (
              <button type="button" onClick={clearEdit} className="text-slate-500 hover:text-slate-300">
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-600 dark:text-slate-400">Title</label>
              <input {...register('title')} className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm outline-none focus:border-neon-blue" />
              {errors.title && <p className="mt-1 text-xs text-red-400">{errors.title.message}</p>}
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-600 dark:text-slate-400">Slug</label>
              <input {...register('slug')} className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm outline-none focus:border-neon-blue" />
              {errors.slug && <p className="mt-1 text-xs text-red-400">{errors.slug.message}</p>}
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-600 dark:text-slate-400">Content</label>
              <textarea {...register('content')} rows={6} className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm outline-none focus:border-neon-blue" />
              {errors.content && <p className="mt-1 text-xs text-red-400">{errors.content.message}</p>}
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-600 dark:text-slate-400">Image URL</label>
              <input {...register('imageUrl')} className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm outline-none focus:border-neon-blue" />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-600 dark:text-slate-400">Published at</label>
              <input type="datetime-local" {...register('publishedAt')} className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm outline-none focus:border-neon-blue" />
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" {...register('isPublished')} className="rounded border-white/10 bg-white/5" />
              Published
            </label>
            <button type="submit" disabled={createMutation.isPending || updateMutation.isPending} className="btn-primary w-full">
              {createMutation.isPending || updateMutation.isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : editing ? (
                <Pencil className="mr-2 h-4 w-4" />
              ) : (
                <Plus className="mr-2 h-4 w-4" />
              )}
              {editing ? 'Update Post' : 'Create Post'}
            </button>
          </form>
        </div>

        <div className="glass-card p-6 lg:col-span-2">
          {isLoading ? (
            <div className="flex h-40 items-center justify-center">
              <Loader2 className="h-6 w-6 animate-spin text-neon-blue" />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-white/10 text-slate-500 dark:text-slate-400">
                    <th className="py-3 font-medium">Title</th>
                    <th className="py-3 font-medium">Author</th>
                    <th className="py-3 font-medium">Published</th>
                    <th className="py-3 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {data?.map((post, idx) => (
                    <motion.tr
                      key={post.id}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: idx * 0.03 }}
                    >
                      <td className="py-3">
                        <div className="flex items-center gap-2">
                          <Newspaper className="h-4 w-4 text-neon-purple" />
                          <span className="font-medium">{post.title}</span>
                        </div>
                        <div className="text-xs text-slate-500">/{post.slug}</div>
                      </td>
                      <td className="py-3 text-slate-600 dark:text-slate-400">{post.author.name}</td>
                      <td className="py-3">
                        <span className={`rounded-full px-2 py-1 text-xs font-semibold ${post.isPublished ? 'bg-green-500/10 text-green-400' : 'bg-slate-500/10 text-slate-400'}`}>
                          {post.isPublished ? 'Yes' : 'No'}
                        </span>
                      </td>
                      <td className="py-3">
                        <div className="flex gap-2">
                          <button onClick={() => startEdit(post)} className="rounded-lg bg-neon-blue/10 p-2 text-neon-blue hover:bg-neon-blue/20">
                            <Pencil className="h-4 w-4" />
                          </button>
                          <button onClick={() => deleteMutation.mutate(post.id)} className="rounded-lg bg-red-500/10 p-2 text-red-400 hover:bg-red-500/20">
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </motion.tr>
                  ))}
                </tbody>
              </table>
              {!data?.length && <div className="mt-8 text-center text-slate-500">No posts yet.</div>}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
