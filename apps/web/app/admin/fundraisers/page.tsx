'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { motion } from 'framer-motion';
import { Loader2, Plus, Pencil, Trash2, X, HeartHandshake } from 'lucide-react';
import { api } from '@/lib/api';

const fundraiserSchema = z.object({
  title: z.string().min(1),
  description: z.string().optional(),
  targetAmount: z.coerce.number().min(0),
  imageUrl: z.string().url().optional().or(z.literal('')),
  startDate: z.string().min(1),
  endDate: z.string().min(1),
  isActive: z.boolean().default(true)
});

type FundraiserForm = z.infer<typeof fundraiserSchema>;

interface Fundraiser {
  id: string;
  title: string;
  description: string | null;
  targetAmount: number;
  raisedAmount: number;
  imageUrl: string | null;
  startDate: string;
  endDate: string;
  isActive: boolean;
}

export default function AdminFundraisersPage() {
  const [editing, setEditing] = useState<Fundraiser | null>(null);
  const queryClient = useQueryClient();
  const { register, handleSubmit, reset, formState: { errors } } = useForm<FundraiserForm>({
    resolver: zodResolver(fundraiserSchema),
    defaultValues: { targetAmount: 0, isActive: true }
  });

  const { data, isLoading } = useQuery<Fundraiser[]>({
    queryKey: ['admin', 'fundraisers'],
    queryFn: async () => {
      const res = await api.get('/admin/fundraisers');
      return res.data;
    }
  });

  const createMutation = useMutation({
    mutationFn: async (values: FundraiserForm) => {
      const res = await api.post('/admin/fundraisers', values);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'fundraisers'] });
      reset();
    }
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, values }: { id: string; values: FundraiserForm }) => {
      const res = await api.put(`/admin/fundraisers/${id}`, values);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'fundraisers'] });
      setEditing(null);
      reset();
    }
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/admin/fundraisers/${id}`);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin', 'fundraisers'] })
  });

  const onSubmit = (values: FundraiserForm) => {
    if (editing) {
      updateMutation.mutate({ id: editing.id, values });
    } else {
      createMutation.mutate(values);
    }
  };

  const startEdit = (f: Fundraiser) => {
    setEditing(f);
    reset({
      title: f.title,
      description: f.description ?? '',
      targetAmount: f.targetAmount,
      imageUrl: f.imageUrl ?? '',
      startDate: new Date(f.startDate).toISOString().slice(0, 10),
      endDate: new Date(f.endDate).toISOString().slice(0, 10),
      isActive: f.isActive
    });
  };

  const clearEdit = () => {
    setEditing(null);
    reset({
      title: '',
      description: '',
      targetAmount: 0,
      imageUrl: '',
      startDate: '',
      endDate: '',
      isActive: true
    });
  };

  return (
    <div>
      <h1 className="section-title">Fundraisers</h1>
      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <div className="glass-card p-6 lg:col-span-1">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-bold">{editing ? 'Edit Fundraiser' : 'Create Fundraiser'}</h2>
            {editing && (
              <button type="button" onClick={clearEdit} className="text-slate-500 hover:text-slate-300">
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-600 dark:text-slate-400">Title</label>
              <input {...register('title')} className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm outline-none focus:border-neon-blue" />
              {errors.title && <p className="mt-1 text-xs text-red-400">{errors.title.message}</p>}
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-600 dark:text-slate-400">Description</label>
              <textarea {...register('description')} rows={3} className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm outline-none focus:border-neon-blue" />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-600 dark:text-slate-400">Target (£)</label>
                <input type="number" step="0.01" {...register('targetAmount')} className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm outline-none focus:border-neon-blue" />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-600 dark:text-slate-400">Image URL</label>
                <input {...register('imageUrl')} className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm outline-none focus:border-neon-blue" />
              </div>
            </div>
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
            <button type="submit" disabled={createMutation.isPending || updateMutation.isPending} className="btn-primary w-full">
              {createMutation.isPending || updateMutation.isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : editing ? (
                <Pencil className="mr-2 h-4 w-4" />
              ) : (
                <Plus className="mr-2 h-4 w-4" />
              )}
              {editing ? 'Update Fundraiser' : 'Create Fundraiser'}
            </button>
          </form>
        </div>

        <div className="glass-card p-6 lg:col-span-2">
          {isLoading ? (
            <div className="flex h-40 items-center justify-center">
              <Loader2 className="h-6 w-6 animate-spin text-neon-blue" />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-white/10 text-slate-500 dark:text-slate-400">
                    <th className="py-3 font-medium">Title</th>
                    <th className="py-3 font-medium">Target</th>
                    <th className="py-3 font-medium">Raised</th>
                    <th className="py-3 font-medium">Active</th>
                    <th className="py-3 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {data?.map((f, idx) => (
                    <motion.tr
                      key={f.id}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: idx * 0.03 }}
                    >
                      <td className="py-3">
                        <div className="flex items-center gap-2">
                          <HeartHandshake className="h-4 w-4 text-neon-gold" />
                          <span className="font-medium">{f.title}</span>
                        </div>
                      </td>
                      <td className="py-3">£{Number(f.targetAmount).toFixed(2)}</td>
                      <td className="py-3">£{Number(f.raisedAmount).toFixed(2)}</td>
                      <td className="py-3">
                        <span className={`rounded-full px-2 py-1 text-xs font-semibold ${f.isActive ? 'bg-green-500/10 text-green-400' : 'bg-slate-500/10 text-slate-400'}`}>
                          {f.isActive ? 'Yes' : 'No'}
                        </span>
                      </td>
                      <td className="py-3">
                        <div className="flex gap-2">
                          <button onClick={() => startEdit(f)} className="rounded-lg bg-neon-blue/10 p-2 text-neon-blue hover:bg-neon-blue/20">
                            <Pencil className="h-4 w-4" />
                          </button>
                          <button onClick={() => deleteMutation.mutate(f.id)} className="rounded-lg bg-red-500/10 p-2 text-red-400 hover:bg-red-500/20">
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </motion.tr>
                  ))}
                </tbody>
              </table>
              {!data?.length && <div className="mt-8 text-center text-slate-500">No fundraisers yet.</div>}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
