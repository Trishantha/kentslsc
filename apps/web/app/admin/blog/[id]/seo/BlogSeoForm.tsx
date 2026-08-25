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
  slug: z.string().min(1).regex(/^[a-z0-9-]+$/, 'Lowercase letters, numbers and hyphens only'),
  metaDescription: z.string().max(160).optional().or(z.literal(''))
});

type SeoForm = z.infer<typeof seoSchema>;

interface BlogSeoFormProps {
  post: AdminBlogPost;
  postId: string;
}

export function BlogSeoForm({ post, postId }: BlogSeoFormProps) {
  const queryClient = useQueryClient();
  const { register, handleSubmit, reset, watch, formState: { errors } } = useForm<SeoForm>({
    resolver: zodResolver(seoSchema),
    defaultValues: { slug: post.slug, metaDescription: post.metaDescription ?? '' }
  });

  useEffect(() => {
    reset({ slug: post.slug, metaDescription: post.metaDescription ?? '' });
  }, [post, reset]);

  const updateMutation = useMutation({
    mutationFn: async (values: SeoForm) => {
      const res = await api.put(`/admin/blog/posts/${postId}`, {
        slug: values.slug,
        metaDescription: values.metaDescription
      });
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'blog'] });
      queryClient.invalidateQueries({ queryKey: ['admin', 'blog', postId] });
    }
  });

  const publicUrl = `/blog/${watch('slug') ?? post.slug}`;

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

      <div>
        <label className="mb-1 block text-sm font-medium text-slate-600 dark:text-slate-400">
          Meta description
          <span className="ml-2 text-xs font-normal text-slate-500">{watch('metaDescription')?.length ?? 0}/160</span>
        </label>
        <textarea
          {...register('metaDescription')}
          rows={3}
          className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm outline-none focus:border-neon-blue"
        />
        {errors.metaDescription && <p className="mt-1 text-xs text-red-400">{errors.metaDescription.message}</p>}
        <p className="mt-1 text-xs text-slate-500">
          Used for search engines and social sharing. Leave blank to fall back to the AI summary or content excerpt.
        </p>
      </div>

      <div className="rounded-xl border border-white/10 bg-white/5 p-4">
        <div className="flex items-center gap-2 text-sm text-slate-500">
          <Globe className="h-4 w-4" />
          <span>Public URL preview</span>
        </div>
        <p className="mt-1 break-all text-sm text-neon-blue">{publicUrl}</p>
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
