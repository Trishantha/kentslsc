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
import { FUNDRAISER_CATEGORIES, type AdminFundraiser } from '../../types';

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

interface FundraiserOverviewFormProps {
  fundraiser: AdminFundraiser;
  fundraiserId: string;
}

export function FundraiserOverviewForm({ fundraiser, fundraiserId }: FundraiserOverviewFormProps) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { register, control, handleSubmit, reset, setValue, watch, formState: { errors } } = useForm<FundraiserForm>({
    resolver: zodResolver(fundraiserSchema),
    defaultValues: {
      title: fundraiser.title,
      description: fundraiser.description ?? '',
      targetAmount: Number(fundraiser.targetAmount),
      category: fundraiser.category,
      imageUrl: fundraiser.imageUrl ?? '',
      imagePath: fundraiser.imagePath ?? '',
      startDate: new Date(fundraiser.startDate).toISOString().slice(0, 10),
      endDate: new Date(fundraiser.endDate).toISOString().slice(0, 10),
      isActive: fundraiser.isActive
    }
  });

  useEffect(() => {
    reset({
      title: fundraiser.title,
      description: fundraiser.description ?? '',
      targetAmount: Number(fundraiser.targetAmount),
      category: fundraiser.category,
      imageUrl: fundraiser.imageUrl ?? '',
      imagePath: fundraiser.imagePath ?? '',
      startDate: new Date(fundraiser.startDate).toISOString().slice(0, 10),
      endDate: new Date(fundraiser.endDate).toISOString().slice(0, 10),
      isActive: fundraiser.isActive
    });
  }, [fundraiser, reset]);

  const updateMutation = useMutation({
    mutationFn: async (values: FundraiserForm) => {
      const res = await api.put(`/admin/fundraisers/${fundraiserId}`, {
        ...values,
        imageUrl: values.imageUrl || undefined,
        imagePath: values.imagePath || undefined
      });
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'fundraisers'] });
      queryClient.invalidateQueries({ queryKey: ['admin', 'fundraiser', fundraiserId] });
    }
  });

  const deleteMutation = useMutation({
    mutationFn: async () => {
      await api.delete(`/admin/fundraisers/${fundraiserId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'fundraisers'] });
      router.push('/admin/fundraisers');
    }
  });

  return (
    <form onSubmit={handleSubmit((values) => updateMutation.mutate(values))} className="glass-card space-y-4 p-6">
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
        <button type="submit" disabled={updateMutation.isPending} className="btn-primary flex-1">
          {updateMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
          Save changes
        </button>
        <button
          type="button"
          onClick={() => {
            if (confirm('Are you sure you want to delete this campaign?')) {
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
