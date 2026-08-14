'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  optionalUrl,
  directoryCategoryGroups,
  directoryCategoryValues
} from '@kentslsc/shared';
import { Loader2, ArrowLeft, Plus } from 'lucide-react';
import Link from 'next/link';
import { api } from '@/lib/api';
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

export default function NewDirectoryListingPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { register, handleSubmit, reset, setValue, watch, control, formState: { errors } } =
    useForm<BusinessForm>({
      resolver: zodResolver(businessSchema),
      defaultValues: {
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
      }
    });

  const createMutation = useMutation({
    mutationFn: async (values: BusinessForm) => {
      const res = await api.post('/admin/directory/businesses', values);
      return res.data as { id: string };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'businesses'] });
      router.push(`/admin/directory/${data.id}/details`);
    }
  });

  return (
    <div>
      <div className="flex items-center gap-3">
        <Link
          href="/admin/directory"
          className="rounded-lg p-2 text-slate-500 hover:bg-white/5 hover:text-slate-300"
        >
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div>
          <h1 className="section-title">Create listing</h1>
          <p className="text-sm text-slate-500">Add a new business to the directory.</p>
        </div>
      </div>

      <div className="mt-6 max-w-2xl">
        <form
          onSubmit={handleSubmit((values) => createMutation.mutate(values))}
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

          {createMutation.error && (
            <p className="text-sm text-red-400">Failed to create listing.</p>
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
              Create listing
            </button>
            <Link
              href="/admin/directory"
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
