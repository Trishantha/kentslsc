'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  optionalUrl,
  directoryCategoryGroups,
  directoryCategoryValues,
  getDirectoryCategoryLabel
} from '@kentslsc/shared';
import { motion } from 'framer-motion';
import { Loader2, Plus, Pencil, Trash2, X, Building2 } from 'lucide-react';
import { api, getApiErrorMessage } from '@/lib/api';
import { ImageUpload } from '@/components/ui/ImageUpload';
import SearchableSelect from '@/components/ui/SearchableSelect';

const businessSchema = z.object({
  businessName: z.string().min(1),
  logoUrl: z.string().url().optional().or(z.literal('')),
  description: z.string().optional(),
  servicesText: z.string().optional(),
  websiteUrl: optionalUrl('Enter a valid website URL, e.g. example.com').or(z.literal('')),
  email: z.string().email().optional().or(z.literal('')),
  phone: z.string().optional(),
  address: z.string().optional(),
  category: z
    .string()
    .refine((val) => !val || directoryCategoryValues.includes(val), {
      message: 'Select a valid category'
    })
    .optional(),
  isPaid: z.boolean().default(false)
});

type BusinessForm = z.infer<typeof businessSchema>;

const categorySelectGroups = directoryCategoryGroups.map((group) => ({
  name: group.name,
  emoji: group.emoji,
  options: group.subcategories.map((sub) => ({ value: sub.name, label: sub.name }))
}));

interface Business {
  id: string;
  businessName: string;
  logoUrl: string | null;
  description: string | null;
  servicesText: string | null;
  websiteUrl: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
  category: string | null;
  isPaid: boolean;
}

export default function AdminDirectoryPage() {
  const [editing, setEditing] = useState<Business | null>(null);
  const queryClient = useQueryClient();
  const { register, handleSubmit, reset, setValue, watch, control, formState: { errors } } = useForm<BusinessForm>({
    resolver: zodResolver(businessSchema)
  });

  const { data, isLoading } = useQuery<Business[]>({
    queryKey: ['admin', 'businesses'],
    queryFn: async () => {
      const res = await api.get('/admin/directory/businesses');
      return res.data;
    }
  });

  const createMutation = useMutation({
    mutationFn: async (values: BusinessForm) => {
      const res = await api.post('/admin/directory/businesses', values);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'businesses'] });
      reset();
    }
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, values }: { id: string; values: BusinessForm }) => {
      const res = await api.put(`/admin/directory/businesses/${id}`, values);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'businesses'] });
      setEditing(null);
      reset();
    }
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/admin/directory/businesses/${id}`);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin', 'businesses'] })
  });

  const onSubmit = (values: BusinessForm) => {
    if (editing) {
      updateMutation.mutate({ id: editing.id, values });
    } else {
      createMutation.mutate(values);
    }
  };

  const startEdit = (business: Business) => {
    setEditing(business);
    reset({
      businessName: business.businessName,
      logoUrl: business.logoUrl ?? '',
      description: business.description ?? '',
      servicesText: business.servicesText ?? '',
      websiteUrl: business.websiteUrl ?? '',
      email: business.email ?? '',
      phone: business.phone ?? '',
      address: business.address ?? '',
      category: business.category ?? '',
      isPaid: business.isPaid
    });
  };

  const clearEdit = () => {
    setEditing(null);
    reset({
      businessName: '',
      logoUrl: '',
      description: '',
      servicesText: '',
      websiteUrl: '',
      email: '',
      phone: '',
      address: '',
      category: '',
      isPaid: false
    });
  };

  return (
    <div>
      <h1 className="section-title">Directory</h1>
      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <div className="glass-card p-6 lg:col-span-1">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-bold">{editing ? 'Edit Listing' : 'Add Listing'}</h2>
            {editing && (
              <button type="button" onClick={clearEdit} className="text-slate-500 hover:text-slate-300">
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-600 dark:text-slate-400">Business name</label>
              <input {...register('businessName')} className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm outline-none focus:border-neon-blue" />
              {errors.businessName && <p className="mt-1 text-xs text-red-400">{errors.businessName.message}</p>}
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-600 dark:text-slate-400">Category</label>
              <Controller
                name="category"
                control={control}
                render={({ field }) => (
                  <SearchableSelect
                    value={field.value ?? ''}
                    onChange={field.onChange}
                    onBlur={field.onBlur}
                    groups={categorySelectGroups}
                    placeholder="All categories"
                    searchPlaceholder="Search categories..."
                    className="mt-1"
                  />
                )}
              />
              {errors.category && <p className="mt-1 text-xs text-red-400">{errors.category.message}</p>}
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-600 dark:text-slate-400">Description</label>
              <textarea {...register('description')} rows={3} className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm outline-none focus:border-neon-blue" />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-600 dark:text-slate-400">Services</label>
              <textarea {...register('servicesText')} rows={2} className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm outline-none focus:border-neon-blue" />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-600 dark:text-slate-400">Email</label>
                <input {...register('email')} className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm outline-none focus:border-neon-blue" />
                {errors.email && <p className="mt-1 text-xs text-red-400">{errors.email.message}</p>}
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-600 dark:text-slate-400">Phone</label>
                <input {...register('phone')} className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm outline-none focus:border-neon-blue" />
              </div>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-600 dark:text-slate-400">Address</label>
              <input {...register('address')} className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm outline-none focus:border-neon-blue" />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-600 dark:text-slate-400">Website</label>
                <input {...register('websiteUrl')} className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm outline-none focus:border-neon-blue" />
                {errors.websiteUrl && <p className="mt-1 text-xs text-red-400">{errors.websiteUrl.message}</p>}
              </div>
              <ImageUpload
                label="Logo"
                value={watch('logoUrl')}
                onChange={(url) => setValue('logoUrl', url, { shouldValidate: true })}
                hideUrlInput
              />
              {errors.logoUrl && <p className="mt-1 text-xs text-red-400">{errors.logoUrl.message}</p>}
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" {...register('isPaid')} className="rounded border-white/10 bg-white/5" />
              Paid listing
            </label>
            {(createMutation.error || updateMutation.error) && (
              <p className="text-sm text-red-400">
                {getApiErrorMessage(createMutation.error ?? updateMutation.error)}
              </p>
            )}
            <button type="submit" disabled={createMutation.isPending || updateMutation.isPending} className="btn-primary w-full">
              {createMutation.isPending || updateMutation.isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : editing ? (
                <Pencil className="mr-2 h-4 w-4" />
              ) : (
                <Plus className="mr-2 h-4 w-4" />
              )}
              {editing ? 'Update Listing' : 'Add Listing'}
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
                    <th className="py-3 font-medium">Business</th>
                    <th className="py-3 font-medium">Category</th>
                    <th className="py-3 font-medium">Paid</th>
                    <th className="py-3 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {data?.map((business, idx) => (
                    <motion.tr
                      key={business.id}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: idx * 0.03 }}
                    >
                      <td className="py-3">
                        <div className="flex items-center gap-3">
                          {business.logoUrl ? (
                            <img src={business.logoUrl} alt="" className="h-8 w-8 rounded-full object-cover" />
                          ) : (
                            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-neon-blue/10 text-neon-blue">
                              <Building2 className="h-4 w-4" />
                            </div>
                          )}
                          <div>
                            <div className="font-medium">{business.businessName}</div>
                            <div className="text-xs text-slate-500">{business.email || '-'}</div>
                          </div>
                        </div>
                      </td>
                      <td className="py-3 text-slate-600 dark:text-slate-400">
                        {business.category ? getDirectoryCategoryLabel(business.category) : '-'}
                      </td>
                      <td className="py-3">
                        <span className={`rounded-full px-2 py-1 text-xs font-semibold ${business.isPaid ? 'bg-green-500/10 text-green-400' : 'bg-slate-500/10 text-slate-400'}`}>
                          {business.isPaid ? 'Yes' : 'No'}
                        </span>
                      </td>
                      <td className="py-3">
                        <div className="flex gap-2">
                          <button onClick={() => startEdit(business)} className="rounded-lg bg-neon-blue/10 p-2 text-neon-blue hover:bg-neon-blue/20">
                            <Pencil className="h-4 w-4" />
                          </button>
                          <button onClick={() => deleteMutation.mutate(business.id)} className="rounded-lg bg-red-500/10 p-2 text-red-400 hover:bg-red-500/20">
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </motion.tr>
                  ))}
                </tbody>
              </table>
              {!data?.length && <div className="mt-8 text-center text-slate-500">No businesses yet.</div>}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
