'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Loader2, ArrowLeft, Plus } from 'lucide-react';
import Link from 'next/link';
import { api } from '@/lib/api';
import { RichTextEditor } from '@/components/ui/RichTextEditor';

const jobSchema = z.object({
  businessListingId: z.string().uuid(),
  title: z.string().min(1),
  description: z.string().optional(),
  location: z.string().optional(),
  salaryRange: z.string().optional(),
  contactEmail: z.string().email().optional().or(z.literal('')),
  closingDate: z.string().optional(),
  isPublished: z.boolean().default(false)
});

type JobForm = z.infer<typeof jobSchema>;

interface Business {
  id: string;
  businessName: string;
}

export default function NewJobPage() {
  const router = useRouter();
  const queryClient = useQueryClient();

  const { data: businesses } = useQuery<Business[]>({
    queryKey: ['admin', 'businesses'],
    queryFn: async () => {
      const res = await api.get('/admin/directory/businesses');
      return res.data;
    }
  });

  const { register, control, handleSubmit, reset, formState: { errors } } = useForm<JobForm>({
    resolver: zodResolver(jobSchema),
    defaultValues: {
      businessListingId: businesses?.[0]?.id ?? '',
      title: '',
      description: '',
      location: '',
      salaryRange: '',
      contactEmail: '',
      closingDate: '',
      isPublished: false
    }
  });

  const createMutation = useMutation({
    mutationFn: async (values: JobForm) => {
      const res = await api.post('/admin/directory/jobs', {
        ...values,
        closingDate: values.closingDate || undefined
      });
      return res.data as { id: string };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'jobs'] });
      router.push(`/admin/jobs/${data.id}/details`);
    }
  });

  return (
    <div>
      <div className="flex items-center gap-3">
        <Link
          href="/admin/jobs"
          className="rounded-lg p-2 text-slate-500 hover:bg-white/5 hover:text-slate-300"
        >
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div>
          <h1 className="section-title">Create job</h1>
          <p className="text-sm text-slate-500">Post a new job advert for a business listing.</p>
        </div>
      </div>

      <div className="mt-6 max-w-2xl">
        <form
          onSubmit={handleSubmit((values) => createMutation.mutate(values))}
          className="glass-card space-y-4 p-6"
        >
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-600 dark:text-slate-400">
              Business
            </label>
            <select
              {...register('businessListingId')}
              className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm outline-none focus:border-neon-blue dark:text-slate-100"
            >
              {businesses?.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.businessName}
                </option>
              ))}
            </select>
            {errors.businessListingId && (
              <p className="mt-1 text-xs text-red-400">{errors.businessListingId.message}</p>
            )}
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-600 dark:text-slate-400">
              Title
            </label>
            <input
              {...register('title')}
              className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm outline-none focus:border-neon-blue"
            />
            {errors.title && <p className="mt-1 text-xs text-red-400">{errors.title.message}</p>}
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-600 dark:text-slate-400">
              Description
            </label>
            <Controller
              name="description"
              control={control}
              render={({ field }) => (
                <RichTextEditor
                  value={field.value ?? ''}
                  onChange={field.onChange}
                  placeholder="Describe responsibilities, requirements, and benefits"
                  minHeightClassName="min-h-[160px]"
                />
              )}
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-600 dark:text-slate-400">
                Location
              </label>
              <input
                {...register('location')}
                className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm outline-none focus:border-neon-blue"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-600 dark:text-slate-400">
                Salary range
              </label>
              <input
                {...register('salaryRange')}
                className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm outline-none focus:border-neon-blue"
              />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-600 dark:text-slate-400">
                Contact email
              </label>
              <input
                {...register('contactEmail')}
                className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm outline-none focus:border-neon-blue"
              />
              {errors.contactEmail && (
                <p className="mt-1 text-xs text-red-400">{errors.contactEmail.message}</p>
              )}
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-600 dark:text-slate-400">
                Closing date
              </label>
              <input
                type="date"
                {...register('closingDate')}
                className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm outline-none focus:border-neon-blue"
              />
            </div>
          </div>

          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              {...register('isPublished')}
              className="rounded border-white/10 bg-white/5"
            />
            Published
          </label>

          {createMutation.error && (
            <p className="text-sm text-red-400">Failed to create job.</p>
          )}

          <div className="flex gap-3 pt-2">
            <button
              type="submit"
              disabled={createMutation.isPending}
              className="btn-primary flex-1"
            >
              {createMutation.isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Plus className="mr-2 h-4 w-4" />
              )}
              Create job
            </button>
            <Link
              href="/admin/jobs"
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
