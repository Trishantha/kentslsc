'use client';

import { useEffect } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Loader2, Save, Trash2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import type { AdminGallery } from '../../types';

const contentSchema = z.object({
  title: z.string().min(1),
  slug: z.string().min(1).regex(/^[a-z0-9-]+$/, 'Lowercase letters, numbers and hyphens only'),
  description: z.string().optional(),
  eventDate: z.string().optional(),
  isPublished: z.boolean().default(false)
});

type ContentForm = z.infer<typeof contentSchema>;

interface GalleryContentFormProps {
  gallery: AdminGallery;
  galleryId: string;
}

export function GalleryContentForm({ gallery, galleryId }: GalleryContentFormProps) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { register, handleSubmit, reset, watch, formState: { errors } } = useForm<ContentForm>({
    resolver: zodResolver(contentSchema),
    defaultValues: {
      title: gallery.title,
      slug: gallery.slug,
      description: gallery.description ?? '',
      eventDate: gallery.eventDate ? new Date(gallery.eventDate).toISOString().slice(0, 10) : '',
      isPublished: gallery.isPublished
    }
  });

  useEffect(() => {
    reset({
      title: gallery.title,
      slug: gallery.slug,
      description: gallery.description ?? '',
      eventDate: gallery.eventDate ? new Date(gallery.eventDate).toISOString().slice(0, 10) : '',
      isPublished: gallery.isPublished
    });
  }, [gallery, reset]);

  const updateMutation = useMutation({
    mutationFn: async (values: ContentForm) => {
      const res = await api.put(`/galleries/admin/${galleryId}`, {
        ...values,
        description: values.description || undefined,
        eventDate: values.eventDate || undefined
      });
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'galleries'] });
      queryClient.invalidateQueries({ queryKey: ['admin', 'galleries', galleryId] });
    }
  });

  const deleteMutation = useMutation({
    mutationFn: async () => {
      await api.delete(`/galleries/admin/${galleryId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'galleries'] });
      router.push('/admin/blog/galleries');
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
        <label className="mb-1 block text-sm font-medium text-slate-600 dark:text-slate-400">Slug</label>
        <input {...register('slug')} className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm outline-none focus:border-neon-blue" />
        {errors.slug && <p className="mt-1 text-xs text-red-400">{errors.slug.message}</p>}
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium text-slate-600 dark:text-slate-400">Description</label>
        <textarea
          {...register('description')}
          rows={4}
          className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm outline-none focus:border-neon-blue"
        />
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium text-slate-600 dark:text-slate-400">Event date</label>
        <input
          type="date"
          {...register('eventDate')}
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
            if (confirm('Are you sure you want to delete this gallery?')) {
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
