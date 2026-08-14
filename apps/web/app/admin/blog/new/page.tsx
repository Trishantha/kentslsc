'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Loader2, ArrowLeft, Plus } from 'lucide-react';
import Link from 'next/link';
import { api } from '@/lib/api';
import { ImageUpload } from '@/components/ui/ImageUpload';
import { RichTextEditor } from '@/components/ui/RichTextEditor';
import { hasRichTextContent } from '@/lib/rich-text';

const blogSchema = z.object({
  title: z.string().min(1),
  slug: z.string().min(1).regex(/^[a-z0-9-]+$/, 'Lowercase letters, numbers and hyphens only'),
  content: z.string().refine((value) => hasRichTextContent(value), 'Content is required'),
  imageUrl: z.string().url().optional().or(z.literal('')),
  publishedAt: z.string().optional(),
  isPublished: z.boolean().default(false)
});

type BlogForm = z.infer<typeof blogSchema>;

export default function NewBlogPostPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { register, control, handleSubmit, reset, setValue, watch, formState: { errors } } = useForm<BlogForm>({
    resolver: zodResolver(blogSchema),
    defaultValues: {
      title: '',
      slug: '',
      content: '',
      imageUrl: '',
      publishedAt: '',
      isPublished: false
    }
  });

  const createMutation = useMutation({
    mutationFn: async (values: BlogForm) => {
      const res = await api.post('/admin/blog/posts', {
        ...values,
        imageUrl: values.imageUrl || undefined,
        publishedAt: values.publishedAt || undefined
      });
      return res.data as { id: string };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'blog'] });
      router.push(`/admin/blog/${data.id}/content`);
    }
  });

  return (
    <div>
      <div className="flex items-center gap-3">
        <Link
          href="/admin/blog"
          className="rounded-lg p-2 text-slate-500 hover:bg-white/5 hover:text-slate-300"
        >
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div>
          <h1 className="section-title">Create post</h1>
          <p className="text-sm text-slate-500">Write the post content first, then review SEO and preview.</p>
        </div>
      </div>

      <div className="mt-6 max-w-2xl">
        <form
          onSubmit={handleSubmit((values) => createMutation.mutate(values))}
          className="glass-card space-y-4 p-6"
        >
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

          {createMutation.error && (
            <p className="text-sm text-red-400">Failed to create post.</p>
          )}

          <div className="flex gap-3 pt-2">
            <button type="submit" disabled={createMutation.isPending} className="btn-primary flex-1">
              {createMutation.isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Plus className="mr-2 h-4 w-4" />
              )}
              Create post
            </button>
            <Link
              href="/admin/blog"
              className="btn-secondary inline-flex items-center justify-center"
              onClick={() => reset()}
            >
              Cancel
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
}
