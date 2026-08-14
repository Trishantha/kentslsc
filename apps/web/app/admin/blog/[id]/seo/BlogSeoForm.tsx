'use client';

import { useEffect } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Loader2, Save, Globe } from 'lucide-react';
import { api } from '@/lib/api';
import type { AdminBlogPost } from '../../types';

const seoSchema = z.object({
  slug: z.string().min(1).regex(/^[a-z0-9-]+$/, 'Lowercase letters, numbers and hyphens only')
});

type SeoForm = z.infer<typeof seoSchema>;

interface BlogSeoFormProps {
  post: AdminBlogPost;
  postId: string;
}

export function BlogSeoForm({ post, postId }: BlogSeoFormProps) {
  const queryClient = useQueryClient();
  const { register, handleSubmit, reset, formState: { errors } } = useForm<SeoForm>({
    resolver: zodResolver(seoSchema),
    defaultValues: { slug: post.slug }
  });

  useEffect(() => {
    reset({ slug: post.slug });
  }, [post, reset]);

  const updateMutation = useMutation({
    mutationFn: async (values: SeoForm) => {
      const res = await api.put(`/admin/blog/posts/${postId}`, values);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'blog'] });
      queryClient.invalidateQueries({ queryKey: ['admin', 'blog', postId] });
    }
  });

  const publicUrl = `/blog/${post.slug}`;

  return (
    <form
      onSubmit={handleSubmit((values) => updateMutation.mutate(values))}
      className="glass-card space-y-4 p-6"
    >
      <div>
        <label className="mb-1 block text-sm font-medium text-slate-600 dark:text-slate-400">Slug</label>
        <input
          {...register('slug')}
          className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm outline-none focus:border-neon-blue"
        />
        {errors.slug && <p className="mt-1 text-xs text-red-400">{errors.slug.message}</p>}
      </div>

      <div className="rounded-xl border border-white/10 bg-white/5 p-4">
        <div className="flex items-center gap-2 text-sm text-slate-500">
          <Globe className="h-4 w-4" />
          <span>Public URL preview</span>
        </div>
        <p className="mt-1 break-all text-sm text-neon-blue">{publicUrl}</p>
      </div>

      <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-4">
        <p className="text-sm text-amber-400">
          Meta title and meta description fields are not currently available in the blog model.
          The public page uses the post title and an AI-generated summary (or the first part of the content) for SEO.
        </p>
      </div>

      <div className="flex gap-3 pt-2">
        <button type="submit" disabled={updateMutation.isPending} className="btn-primary flex-1">
          {updateMutation.isPending ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Save className="mr-2 h-4 w-4" />
          )}
          Save changes
        </button>
      </div>
    </form>
  );
}
