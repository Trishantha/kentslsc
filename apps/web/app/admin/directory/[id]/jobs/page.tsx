'use client';

import { use, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { motion } from 'framer-motion';
import { Plus, Pencil, Trash2, X, Loader2, Briefcase } from 'lucide-react';
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

interface Props {
  params: Promise<{ id: string }>;
}

export default function DirectoryJobsPage({ params }: Props) {
  const { id: businessId } = use(params);
  const [editing, setEditing] = useState<AdminJob | null>(null);
  const [showForm, setShowForm] = useState(false);
  const queryClient = useQueryClient();

  const { register, control, handleSubmit, reset, formState: { errors } } =
    useForm<JobForm>({
      resolver: zodResolver(jobSchema),
      defaultValues: {
        businessListingId: businessId,
        title: '',
        description: '',
        location: '',
        salaryRange: '',
        contactEmail: '',
        closingDate: '',
        isPublished: false
      }
    });

  const { data: jobs, isLoading } = useQuery<AdminJob[]>({
    queryKey: ['admin', 'directory', businessId, 'jobs'],
    queryFn: async () => {
      const res = await api.get('/admin/directory/jobs');
      return (res.data as AdminJob[]).filter((j) => j.businessListingId === businessId);
    }
  });

  const createMutation = useMutation({
    mutationFn: async (values: JobForm) => {
      const res = await api.post('/admin/directory/jobs', {
        ...values,
        closingDate: values.closingDate || undefined
      });
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'directory', businessId, 'jobs'] });
      reset();
      setShowForm(false);
    }
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, values }: { id: string; values: JobForm }) => {
      const res = await api.put(`/admin/directory/jobs/${id}`, {
        ...values,
        closingDate: values.closingDate || undefined
      });
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'directory', businessId, 'jobs'] });
      setEditing(null);
      setShowForm(false);
      reset();
    }
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/admin/directory/jobs/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'directory', businessId, 'jobs'] });
    }
  });

  const onSubmit = (values: JobForm) => {
    if (editing) {
      updateMutation.mutate({ id: editing.id, values });
    } else {
      createMutation.mutate(values);
    }
  };

  const startEdit = (job: AdminJob) => {
    setEditing(job);
    setShowForm(true);
    reset({
      businessListingId: businessId,
      title: job.title,
      description: job.description ?? '',
      location: job.location ?? '',
      salaryRange: job.salaryRange ?? '',
      contactEmail: job.contactEmail ?? '',
      closingDate: job.closingDate
        ? new Date(job.closingDate).toISOString().slice(0, 10)
        : '',
      isPublished: job.isPublished
    });
  };

  const clearEdit = () => {
    setEditing(null);
    setShowForm(false);
    reset({
      businessListingId: businessId,
      title: '',
      description: '',
      location: '',
      salaryRange: '',
      contactEmail: '',
      closingDate: '',
      isPublished: false
    });
  };

  return (
    <div className="max-w-3xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold">Jobs</h2>
          <p className="text-sm text-slate-500">Manage job adverts for this business.</p>
        </div>
        {!showForm && (
          <button
            type="button"
            onClick={() => setShowForm(true)}
            className="btn-secondary inline-flex items-center gap-2"
          >
            <Plus className="h-4 w-4" />
            Add job
          </button>
        )}
      </div>

      {showForm && (
        <div className="glass-card p-6">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="font-bold">{editing ? 'Edit Job' : 'Post Job'}</h3>
            <button
              type="button"
              onClick={clearEdit}
              className="text-slate-500 hover:text-slate-300"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-600 dark:text-slate-400">
                Title
              </label>
              <input
                {...register('title')}
                className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm outline-none focus:border-neon-blue"
              />
              {errors.title && (
                <p className="mt-1 text-xs text-red-400">{errors.title.message}</p>
              )}
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
                disabled={createMutation.isPending || updateMutation.isPending}
                className="btn-primary flex-1"
              >
                {createMutation.isPending || updateMutation.isPending ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : editing ? (
                  <Pencil className="mr-2 h-4 w-4" />
                ) : (
                  <Plus className="mr-2 h-4 w-4" />
                )}
                {editing ? 'Update Job' : 'Post Job'}
              </button>
              <button
                type="button"
                onClick={clearEdit}
                className="btn-secondary inline-flex items-center justify-center"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="glass-card p-6">
        {isLoading ? (
          <div className="flex h-40 items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-neon-blue" />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-white/10 text-slate-500 dark:text-slate-400">
                  <th className="px-4 py-3 font-medium">Title</th>
                  <th className="px-4 py-3 font-medium">Location</th>
                  <th className="px-4 py-3 font-medium">Published</th>
                  <th className="px-4 py-3 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {jobs?.map((job, idx) => (
                  <motion.tr
                    key={job.id}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: idx * 0.03 }}
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <Briefcase className="h-4 w-4 text-neon-blue" />
                        <span className="font-medium">{job.title}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-slate-600 dark:text-slate-400">
                      {job.location || '-'}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                          job.isPublished
                            ? 'bg-green-500/10 text-green-400'
                            : 'bg-slate-500/10 text-slate-400'
                        }`}
                      >
                        {job.isPublished ? 'Yes' : 'No'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-2">
                        <button
                          onClick={() => startEdit(job)}
                          className="rounded-lg bg-neon-blue/10 p-2 text-neon-blue hover:bg-neon-blue/20"
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => {
                            if (confirm('Are you sure you want to delete this job?')) {
                              deleteMutation.mutate(job.id);
                            }
                          }}
                          className="rounded-lg bg-red-500/10 p-2 text-red-400 hover:bg-red-500/20"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </motion.tr>
                ))}
              </tbody>
            </table>
            {!jobs?.length && (
              <div className="mt-8 text-center text-slate-500">
                {showForm ? 'Fill in the form above to add a job.' : 'No jobs yet.'}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
