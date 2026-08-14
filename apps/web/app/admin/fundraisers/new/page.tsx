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
import { FUNDRAISER_CATEGORIES } from '../types';

const fundraiserSchema = z.object({
  title: z.string().min(1),
  description: z.string().optional(),
  targetAmount: z.coerce.number().min(0),
  category: z.string().default('CHARITY'),
  imageUrl: z.string().optional().or(z.literal('')),
  imagePath: z.string().optional(),
  startDate: z.string().min(1),
  endDate: z.string().min(1),
  isActive: z.boolean().default(true)
});

type FundraiserForm = z.infer<typeof fundraiserSchema>;

export default function NewFundraiserPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { register, control, handleSubmit, reset, setValue, watch, formState: { errors } } = useForm<FundraiserForm>({
    resolver: zodResolver(fundraiserSchema),
    defaultValues: { targetAmount: 0, isActive: true, category: 'CHARITY' }
  });

  const createMutation = useMutation({
    mutationFn: async (values: FundraiserForm) => {
      const res = await api.post('/admin/fundraisers', {
        ...values,
        imageUrl: values.imageUrl || undefined,
        imagePath: values.imagePath || undefined
      });
      return res.data as { id: string };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'fundraisers'] });
      router.push(`/admin/fundraisers/${data.id}/overview`);
    }
  });

  return (
    <div>
      <div className="flex items-center gap-3">
        <Link
          href="/admin/fundraisers"
          className="rounded-lg p-2 text-slate-500 hover:bg-white/5 hover:text-slate-300"
        >
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div>
          <h1 className="section-title">Create campaign</h1>
          <p className="text-sm text-slate-500">Set up the fundraiser details first, then manage donations and updates.</p>
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
            <label className="mb-1 block text-sm font-medium text-slate-600 dark:text-slate-400">Description</label>
            <Controller
              name="description"
              control={control}
              render={({ field }) => (
                <RichTextEditor
                  value={field.value ?? ''}
                  onChange={field.onChange}
                  placeholder="Describe the campaign with formatted content"
                  minHeightClassName="min-h-[160px]"
                />
              )}
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-600 dark:text-slate-400">Category</label>
            <select {...register('category')} className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm outline-none focus:border-neon-blue">
              {FUNDRAISER_CATEGORIES.map((c) => (
                <option key={c.value} value={c.value}>{c.label}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-600 dark:text-slate-400">Target (£)</label>
            <input
              type="number"
              step="0.01"
              {...register('targetAmount')}
              className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm outline-none focus:border-neon-blue"
            />
          </div>

          <ImageUpload
            label="Campaign Image"
            value={watch('imageUrl')}
            onChange={(url, path) => {
              setValue('imageUrl', url, { shouldValidate: true });
              if (path) setValue('imagePath', path, { shouldValidate: true });
            }}
            hideUrlInput
            showPreview
          />

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-600 dark:text-slate-400">Start date</label>
              <input type="date" {...register('startDate')} className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm outline-none focus:border-neon-blue" />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-600 dark:text-slate-400">End date</label>
              <input type="date" {...register('endDate')} className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm outline-none focus:border-neon-blue" />
            </div>
          </div>

          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" {...register('isActive')} className="rounded border-white/10 bg-white/5" />
            Active
          </label>

          <div className="flex gap-3 pt-2">
            <button type="submit" disabled={createMutation.isPending} className="btn-primary flex-1">
              {createMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />}
              Create campaign
            </button>
            <Link
              href="/admin/fundraisers"
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
