'use client';

import { useEffect } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  optionalUrl,
  directoryCategoryGroups,
  directoryCategoryValues
} from '@kentslsc/shared';
import { Loader2, Save, Trash2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { ImageUpload } from '@/components/ui/ImageUpload';
import SearchableSelect from '@/components/ui/SearchableSelect';
import type { AdminBusiness } from '../../types';

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

interface BusinessDetailsFormProps {
  business: AdminBusiness;
  businessId: string;
}

export function BusinessDetailsForm({ business, businessId }: BusinessDetailsFormProps) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { register, handleSubmit, reset, setValue, watch, control, formState: { errors } } =
    useForm<BusinessForm>({
      resolver: zodResolver(businessSchema),
      defaultValues: {
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
      }
    });

  useEffect(() => {
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
  }, [business, reset]);

  const updateMutation = useMutation({
    mutationFn: async (values: BusinessForm) => {
      const res = await api.put(`/admin/directory/businesses/${businessId}`, values);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'businesses'] });
      queryClient.invalidateQueries({ queryKey: ['admin', 'business', businessId] });
    }
  });

  const deleteMutation = useMutation({
    mutationFn: async () => {
      await api.delete(`/admin/directory/businesses/${businessId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'businesses'] });
      router.push('/admin/directory');
    }
  });

  return (
    <form
      onSubmit={handleSubmit((values) => updateMutation.mutate(values))}
      className="glass-card space-y-4 p-6"
    >
      <div>
        <label className="mb-1 block text-sm font-medium text-slate-600 dark:text-slate-400">
          Business name
        </label>
        <input
          {...register('businessName')}
          className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm outline-none focus:border-neon-blue"
        />
        {errors.businessName && (
          <p className="mt-1 text-xs text-red-400">{errors.businessName.message}</p>
        )}
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium text-slate-600 dark:text-slate-400">
          Category
        </label>
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
        {errors.category && (
          <p className="mt-1 text-xs text-red-400">{errors.category.message}</p>
        )}
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium text-slate-600 dark:text-slate-400">
          Description
        </label>
        <textarea
          {...register('description')}
          rows={3}
          className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm outline-none focus:border-neon-blue"
        />
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium text-slate-600 dark:text-slate-400">
          Services
        </label>
        <textarea
          {...register('servicesText')}
          rows={2}
          className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm outline-none focus:border-neon-blue"
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-600 dark:text-slate-400">
            Email
          </label>
          <input
            {...register('email')}
            className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm outline-none focus:border-neon-blue"
          />
          {errors.email && <p className="mt-1 text-xs text-red-400">{errors.email.message}</p>}
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-600 dark:text-slate-400">
            Phone
          </label>
          <input
            {...register('phone')}
            className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm outline-none focus:border-neon-blue"
          />
        </div>
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium text-slate-600 dark:text-slate-400">
          Address
        </label>
        <input
          {...register('address')}
          className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm outline-none focus:border-neon-blue"
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-600 dark:text-slate-400">
            Website
          </label>
          <input
            {...register('websiteUrl')}
            className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm outline-none focus:border-neon-blue"
          />
          {errors.websiteUrl && (
            <p className="mt-1 text-xs text-red-400">{errors.websiteUrl.message}</p>
          )}
        </div>
        <ImageUpload
          label="Logo"
          value={watch('logoUrl')}
          onChange={(url) => setValue('logoUrl', url, { shouldValidate: true })}
          hideUrlInput
        />
        {errors.logoUrl && (
          <p className="mt-1 text-xs text-red-400">{errors.logoUrl.message}</p>
        )}
      </div>

      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          {...register('isPaid')}
          className="rounded border-white/10 bg-white/5"
        />
        Paid listing
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
            if (confirm('Are you sure you want to delete this listing?')) {
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
