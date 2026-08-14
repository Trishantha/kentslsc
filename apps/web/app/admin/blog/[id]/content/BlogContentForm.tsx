'use client';

import { useEffect } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Loader2, Save, Trash2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { ImageUpload } from '@/components/ui/ImageUpload';
import { RichTextEditor } from '@/components/ui/RichTextEditor';
import { hasRichTextContent } from '@/lib/rich-text';
import type { AdminBlogPost } from '../../types';

const contentSchema = z.object({
  title: z.string().min(1),
  content: z.string().refine((value) => hasRichTextContent(value), 'Content is required'),
  imageUrl: z.string().url().optional().or(z.literal('')),
  publishedAt: z.string().optional(),
  isPublished: z.boolean().default(false)
});

type ContentForm = z.infer<typeof contentSchema>;

interface BlogContentFormProps {
  post: AdminBlogPost;
  postId: string;
}

export function BlogContentForm({ post, postId }: BlogContentFormProps) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { register, control, handleSubmit, reset, setValue, watch, formState: { errors } } = useForm<ContentForm>({
    resolver: zodResolver(contentSchema),
    defaultValues: {
      title: post.title,
      content: post.content,
      imageUrl: post.imageUrl ?? '',
      publishedAt: post.publishedAt ? new Date(post.publishedAt).toISOString().slice(0, 16) : '',
      isPublished: post.isPublished
    }
  });

  useEffect(() => {
    reset({
      title: post.title,
      content: post.content,
      imageUrl: post.imageUrl ?? '',
      publishedAt: post.publishedAt ? new Date(post.publishedAt).toISOString().slice(0, 16) : '',
      isPublished: post.isPublished
    });
  }, [post, reset]);

  const updateMutation = useMutation({
    mutationFn: async (values: ContentForm) => {
      const res = await api.put(`/admin/blog/posts/${postId}`, {
        ...values,
        imageUrl: values.imageUrl || undefined,
        publishedAt: values.publishedAt || undefined
      });
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'blog'] });
      queryClient.invalidateQueries({ queryKey: ['admin', 'blog', postId] });
    }
  });

  const deleteMutation = useMutation({
    mutationFn: async () => {
      await api.delete(`/admin/blog/posts/${postId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'blog'] });
      router.push('/admin/blog');
    }
  });

  return (
    <form
      onSubmit={handleSubmit((values) => updateMutation.mutate(values))}
      className="glass-card space-y-4 p-6"
    >
      <div>
        <label className="mb-1 block text-sm font-medium text-slate-600 dark:text-slate-400">Title</label>
        <input {...register('title')} className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm outline-none focus:border-neon-blue" />
        {errors.title && <p className="mt-1 text-xs text-red-400">{errors.title.message}</p>}
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium text-slate-600 dark:text-slate-400">Content</label>
        <Controller
          name="content"
          control={control}
          render={({ field }) => (
            <RichTextEditor
              value={field.value}
              onChange={field.onChange}
              placeholder="Write blog content with headings, lists, and links"
              minHeightClassName="min-h-[260px]"
            />
          )}
        />
        {errors.content && <p className="mt-1 text-xs text-red-400">{errors.content.message}</p>}
      </div>

      <ImageUpload
        label="Image"
        value={watch('imageUrl')}
        onChange={(url) => setValue('imageUrl', url, { shouldValidate: true })}
        hideUrlInput
      />

      <div>
        <label className="mb-1 block text-sm font-medium text-slate-600 dark:text-slate-400">Published at</label>
        <input
          type="datetime-local"
          {...register('publishedAt')}
          className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm outline-none focus:border-neon-blue"
        />
      </div>

      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" {...register('isPublished')} className="rounded border-white/10 bg-white/5" />
        Published
      </label>

      <div className="flex gap-3 pt-2">
        <button type="submit" disabled={updateMutation.isPending} className="btn-primary flex-1">
          {updateMutation.isPending ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Save className="mr-2 h-4 w-4" />
          )}
          Save changes
        </button>
        <button
          type="button"
          onClick={() => {
            if (confirm('Are you sure you want to delete this post?')) {
              deleteMutation.mutate();
            }
          }}
          disabled={deleteMutation.isPending}
          className="inline-flex items-center justify-center gap-2 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-2 text-sm font-medium text-red-400 transition-colors hover:bg-red-500/20"
        >
          <Trash2 className="h-4 w-4" />
          Delete
        </button>
      </div>
    </form>
  );
}
