'use client';

import { useEffect } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Loader2, Save, Trash2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { RichTextEditor } from '@/components/ui/RichTextEditor';
import type { AdminJob } from '../../types';

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

interface JobDetailsFormProps {
  job: AdminJob;
  jobId: string;
}

export function JobDetailsForm({ job, jobId }: JobDetailsFormProps) {
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
      businessListingId: job.businessListingId,
      title: job.title,
      description: job.description ?? '',
      location: job.location ?? '',
      salaryRange: job.salaryRange ?? '',
      contactEmail: job.contactEmail ?? '',
      closingDate: job.closingDate ? new Date(job.closingDate).toISOString().slice(0, 10) : '',
      isPublished: job.isPublished
    }
  });

  useEffect(() => {
    reset({
      businessListingId: job.businessListingId,
      title: job.title,
      description: job.description ?? '',
      location: job.location ?? '',
      salaryRange: job.salaryRange ?? '',
      contactEmail: job.contactEmail ?? '',
      closingDate: job.closingDate ? new Date(job.closingDate).toISOString().slice(0, 10) : '',
      isPublished: job.isPublished
    });
  }, [job, reset]);

  const updateMutation = useMutation({
    mutationFn: async (values: JobForm) => {
      const res = await api.put(`/admin/directory/jobs/${jobId}`, {
        ...values,
        closingDate: values.closingDate || undefined
      });
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'jobs'] });
      queryClient.invalidateQueries({ queryKey: ['admin', 'job', jobId] });
    }
  });

  const deleteMutation = useMutation({
    mutationFn: async () => {
      await api.delete(`/admin/directory/jobs/${jobId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'jobs'] });
      router.push('/admin/jobs');
    }
  });

  return (
    <form
      onSubmit={handleSubmit((values) => updateMutation.mutate(values))}
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

      <div className="flex gap-3 pt-2">
        <button
          type="submit"
          disabled={updateMutation.isPending}
          className="btn-primary flex-1"
        >
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
            if (confirm('Are you sure you want to delete this job?')) {
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
