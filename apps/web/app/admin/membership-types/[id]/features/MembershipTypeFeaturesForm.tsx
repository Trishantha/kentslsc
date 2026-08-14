'use client';

import { useEffect } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Loader2, Save, Check } from 'lucide-react';
import { MembershipFeature } from '@kentslsc/shared';
import { api, getApiErrorMessage } from '@/lib/api';
import type { AdminMembershipType } from '../../types';

const featuresSchema = z.object({
  benefits: z.string().optional(),
  features: z.array(z.nativeEnum(MembershipFeature)).default([])
});

type FeaturesForm = z.infer<typeof featuresSchema>;

interface FeatureDef {
  value: MembershipFeature;
  label: string;
  description: string;
}

interface MembershipTypeFeaturesFormProps {
  membershipType: AdminMembershipType;
}

export function MembershipTypeFeaturesForm({ membershipType }: MembershipTypeFeaturesFormProps) {
  const queryClient = useQueryClient();

  const { register, control, handleSubmit, reset, formState: { errors } } = useForm<FeaturesForm>({
    resolver: zodResolver(featuresSchema),
    defaultValues: {
      benefits: membershipType.benefits.join('\n'),
      features: membershipType.features
    }
  });

  useEffect(() => {
    reset({
      benefits: membershipType.benefits.join('\n'),
      features: membershipType.features
    });
  }, [membershipType, reset]);

  const { data: featureDefinitions = [] } = useQuery<FeatureDef[]>({
    queryKey: ['membership-features'],
    queryFn: async () => {
      const res = await api.get('/membership/features');
      return res.data;
    }
  });

  const updateMutation = useMutation({
    mutationFn: async (values: FeaturesForm) => {
      const res = await api.patch(`/membership/types/${membershipType.id}`, {
        benefits: values.benefits ? values.benefits.split('\n').map((b) => b.trim()).filter(Boolean) : [],
        features: values.features
      });
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'membership-types'] });
      queryClient.invalidateQueries({ queryKey: ['membership-types'] });
    }
  });

  return (
    <form
      onSubmit={handleSubmit((values) => updateMutation.mutate(values))}
      className="glass-card space-y-4 p-6"
    >
      <div>
        <label className="mb-1 block text-sm font-medium text-slate-600 dark:text-slate-400">
          Benefits (one per line)
        </label>
        <textarea
          {...register('benefits')}
          rows={5}
          className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm outline-none focus:border-neon-blue"
        />
      </div>

      <div>
        <label className="mb-2 block text-sm font-medium text-slate-600 dark:text-slate-400">
          Features
        </label>
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
        {errors.features && <p className="mt-1 text-xs text-red-400">{errors.features.message}</p>}
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
