'use client';

import { useEffect } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Loader2, Save } from 'lucide-react';
import { api, getApiErrorMessage } from '@/lib/api';
import type { AdminMembershipType } from '../../types';

const pricingSchema = z.object({
  price: z.coerce.number().min(0, 'Price must be 0 or greater'),
  isFree: z.boolean().default(false),
  durationMonths: z.coerce.number().int().min(1, 'Duration must be at least 1 month'),
  maxIssuances: z.preprocess(
    (val) => (val === '' || val === undefined || val === null ? undefined : Number(val)),
    z.number().int().min(1, 'Limit must be at least 1').optional()
  )
});

type PricingForm = z.infer<typeof pricingSchema>;

interface MembershipTypePricingFormProps {
  membershipType: AdminMembershipType;
}

export function MembershipTypePricingForm({ membershipType }: MembershipTypePricingFormProps) {
  const queryClient = useQueryClient();

  const { register, handleSubmit, reset, setValue, watch, formState: { errors } } = useForm<PricingForm>({
    resolver: zodResolver(pricingSchema),
    defaultValues: {
      price: membershipType.price,
      isFree: membershipType.isFree,
      durationMonths: membershipType.durationMonths,
      maxIssuances: membershipType.maxIssuances ?? undefined
    }
  });

  useEffect(() => {
    reset({
      price: membershipType.price,
      isFree: membershipType.isFree,
      durationMonths: membershipType.durationMonths,
      maxIssuances: membershipType.maxIssuances ?? undefined
    });
  }, [membershipType, reset]);

  const updateMutation = useMutation({
    mutationFn: async (values: PricingForm) => {
      const res = await api.patch(`/membership/types/${membershipType.id}`, {
        price: values.isFree ? 0 : Number(values.price),
        isFree: values.isFree,
        durationMonths: Number(values.durationMonths),
        maxIssuances: values.maxIssuances ? Number(values.maxIssuances) : null
      });
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'membership-types'] });
      queryClient.invalidateQueries({ queryKey: ['membership-types'] });
    }
  });

  const isFree = watch('isFree');

  return (
    <form
      onSubmit={handleSubmit((values) => updateMutation.mutate(values))}
      className="glass-card space-y-4 p-6"
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-600 dark:text-slate-400">
            Price (£)
          </label>
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
          <label className="mb-1 block text-sm font-medium text-slate-600 dark:text-slate-400">
            Duration (months)
          </label>
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
          <label className="mb-1 block text-sm font-medium text-slate-600 dark:text-slate-400">
            Maximum issuances
          </label>
          <input
            type="number"
            min={1}
            {...register('maxIssuances')}
            className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm outline-none focus:border-neon-blue"
            placeholder="Leave blank for unlimited"
          />
          {errors.maxIssuances && <p className="mt-1 text-xs text-red-400">{errors.maxIssuances.message}</p>}
        </div>

        <div className="flex items-center gap-6 pt-6">
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
        </div>
      </div>

      {updateMutation.isError && (
        <p className="text-sm text-red-400">{getApiErrorMessage(updateMutation.error)}</p>
      )}

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
      </div>
    </form>
  );
}
