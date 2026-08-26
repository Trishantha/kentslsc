'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Loader2, ArrowLeft, Plus, Check } from 'lucide-react';
import Link from 'next/link';
import { api } from '@/lib/api';
import { MembershipFeature } from '@kentslsc/shared';
import { getApiErrorMessage } from '@/lib/api';

const membershipTypeSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  description: z.string().optional(),
  price: z.coerce.number().min(0, 'Price must be 0 or greater'),
  isFree: z.boolean().default(false),
  durationMonths: z.coerce.number().int().min(1, 'Duration must be at least 1 month'),
  maxIssuances: z.preprocess(
    (val) => (val === '' || val === undefined || val === null ? undefined : Number(val)),
    z.number().int().min(1, 'Limit must be at least 1').optional()
  ),
  benefits: z.string().optional(),
  features: z.array(z.nativeEnum(MembershipFeature)).default([]),
  autoActivate: z.boolean().default(false),
  grantsMemberRole: z.boolean().default(true)
});

type MembershipTypeForm = z.infer<typeof membershipTypeSchema>;

interface FeatureDef {
  value: MembershipFeature;
  label: string;
  description: string;
}

export default function NewMembershipTypePage() {
  const router = useRouter();
  const queryClient = useQueryClient();

  const { register, control, handleSubmit, setValue, watch, reset, formState: { errors } } = useForm<MembershipTypeForm>({
    resolver: zodResolver(membershipTypeSchema),
    defaultValues: {
      price: 0,
      isFree: false,
      durationMonths: 12,
      features: [],
      autoActivate: false,
      grantsMemberRole: true
    }
  });

  const { data: featureDefinitions = [] } = useQuery<FeatureDef[]>({
    queryKey: ['membership-features'],
    queryFn: async () => {
      const res = await api.get('/membership/features');
      return res.data;
    }
  });

  const createMutation = useMutation({
    mutationFn: async (values: MembershipTypeForm) => {
      const payload = {
        ...values,
        description: values.description || undefined,
        maxIssuances: values.maxIssuances ? Number(values.maxIssuances) : null,
        benefits: values.benefits ? values.benefits.split('\n').map((b) => b.trim()).filter(Boolean) : [],
        price: values.isFree ? 0 : Number(values.price)
      };
      const res = await api.post('/membership/types', payload);
      return res.data as { id: string };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'membership-types'] });
      router.push(`/admin/membership-types/${data.id}/details`);
    }
  });

  const isFree = watch('isFree');

  return (
    <div>
      <div className="flex items-center gap-3">
        <Link
          href="/admin/membership-types"
          className="rounded-lg p-2 text-slate-500 hover:bg-white/5 hover:text-slate-300"
        >
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div>
          <h1 className="section-title">Create membership type</h1>
          <p className="text-sm text-slate-500">Set up the membership tier, pricing, duration, and features.</p>
        </div>
      </div>

      <div className="mt-6 max-w-2xl">
        <form
          onSubmit={handleSubmit((values) => createMutation.mutate(values))}
          className="glass-card space-y-4 p-6"
        >
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-600 dark:text-slate-400">Name</label>
            <input {...register('name')} className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm outline-none focus:border-neon-blue" />
            {errors.name && <p className="mt-1 text-xs text-red-400">{errors.name.message}</p>}
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-600 dark:text-slate-400">Description</label>
            <input {...register('description')} className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm outline-none focus:border-neon-blue" />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-600 dark:text-slate-400">Price (£)</label>
              <input
                type="number"
                step="0.01"
                min={0}
                disabled={isFree}
                {...register('price')}
                className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm outline-none focus:border-neon-blue disabled:opacity-50"
              />
              {errors.price && <p className="mt-1 text-xs text-red-400">{errors.price.message}</p>}
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-600 dark:text-slate-400">Duration (months)</label>
              <input
                type="number"
                min={1}
                {...register('durationMonths')}
                className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm outline-none focus:border-neon-blue"
              />
              {errors.durationMonths && <p className="mt-1 text-xs text-red-400">{errors.durationMonths.message}</p>}
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-600 dark:text-slate-400">Maximum issuances</label>
              <input
                type="number"
                min={1}
                {...register('maxIssuances')}
                className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm outline-none focus:border-neon-blue"
                placeholder="Leave blank for unlimited"
              />
              {errors.maxIssuances && <p className="mt-1 text-xs text-red-400">{errors.maxIssuances.message}</p>}
            </div>
            <div className="flex flex-wrap items-center gap-6 pt-6">
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  {...register('isFree')}
                  onChange={(e) => {
                    setValue('isFree', e.target.checked);
                    if (e.target.checked) setValue('price', 0);
                  }}
                  className="rounded border-white/10 bg-white/5"
                />
                Free
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  {...register('autoActivate')}
                  className="rounded border-white/10 bg-white/5"
                />
                Auto-activate
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  {...register('grantsMemberRole')}
                  className="rounded border-white/10 bg-white/5"
                />
                Grants member role while active
              </label>
            </div>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-600 dark:text-slate-400">Benefits (one per line)</label>
            <textarea
              {...register('benefits')}
              rows={4}
              className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm outline-none focus:border-neon-blue"
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-slate-600 dark:text-slate-400">Features</label>
            <Controller
              name="features"
              control={control}
              render={({ field }) => (
                <div className="grid gap-2 sm:grid-cols-2">
                  {featureDefinitions.map((feature) => {
                    const checked = field.value.includes(feature.value);
                    return (
                      <button
                        key={feature.value}
                        type="button"
                        onClick={() => {
                          const next = checked
                            ? field.value.filter((f) => f !== feature.value)
                            : [...field.value, feature.value];
                          field.onChange(next);
                        }}
                        className={`flex items-start gap-3 rounded-xl border p-3 text-left transition-colors ${
                          checked ? 'border-neon-blue bg-neon-blue/10' : 'border-white/10 bg-white/5'
                        }`}
                      >
                        <div className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded border ${checked ? 'border-neon-blue bg-neon-blue' : 'border-white/20'}`}>
                          {checked && <Check className="h-3 w-3 text-slate-950" />}
                        </div>
                        <div>
                          <div className="text-sm font-medium">{feature.label}</div>
                          <div className="text-xs text-slate-500">{feature.description}</div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            />
          </div>

          {createMutation.isError && (
            <p className="text-sm text-red-400">{getApiErrorMessage(createMutation.error)}</p>
          )}

          <div className="flex gap-3 pt-2">
            <button type="submit" disabled={createMutation.isPending} className="btn-primary flex-1">
              {createMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />}
              Create type
            </button>
            <Link
              href="/admin/membership-types"
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
