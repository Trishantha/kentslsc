'use client';

import { useEffect, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Loader2, Save, PauseCircle, PlayCircle, AlertTriangle } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { api, getApiErrorMessage } from '@/lib/api';
import type { AdminMembershipType } from '../../types';

const detailsSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  description: z.string().optional(),
  autoActivate: z.boolean().default(false)
});

type DetailsForm = z.infer<typeof detailsSchema>;

interface MembershipTypeDetailsFormProps {
  membershipType: AdminMembershipType;
}

export function MembershipTypeDetailsForm({ membershipType }: MembershipTypeDetailsFormProps) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [isPauseModalOpen, setIsPauseModalOpen] = useState(false);
  const [targetTypeId, setTargetTypeId] = useState<string>('');

  const { register, handleSubmit, reset, formState: { errors } } = useForm<DetailsForm>({
    resolver: zodResolver(detailsSchema),
    defaultValues: {
      name: membershipType.name,
      description: membershipType.description ?? '',
      autoActivate: membershipType.autoActivate
    }
  });

  useEffect(() => {
    reset({
      name: membershipType.name,
      description: membershipType.description ?? '',
      autoActivate: membershipType.autoActivate
    });
  }, [membershipType, reset]);

  const updateMutation = useMutation({
    mutationFn: async (values: DetailsForm) => {
      const res = await api.patch(`/membership/types/${membershipType.id}`, {
        ...values,
        description: values.description || undefined
      });
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'membership-types'] });
      queryClient.invalidateQueries({ queryKey: ['membership-types'] });
    }
  });

  const pauseMutation = useMutation({
    mutationFn: async (targetMembershipTypeId: string) => {
      const res = await api.post(`/membership/types/${membershipType.id}/pause`, {
        targetMembershipTypeId
      });
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'membership-types'] });
      queryClient.invalidateQueries({ queryKey: ['membership-types'] });
      setIsPauseModalOpen(false);
      router.push('/admin/membership-types');
    }
  });

  const resumeMutation = useMutation({
    mutationFn: async () => {
      const res = await api.post(`/membership/types/${membershipType.id}/resume`);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'membership-types'] });
      queryClient.invalidateQueries({ queryKey: ['membership-types'] });
    }
  });

  const { data: availableTypes = [] } = useQuery<AdminMembershipType[]>({
    queryKey: ['membership-types'],
    queryFn: async () => {
      const res = await api.get('/membership/types');
      return res.data;
    },
    enabled: isPauseModalOpen
  });

  const targetTypes = availableTypes.filter((t) => t.id !== membershipType.id);

  const handlePause = () => {
    if (!targetTypeId) return;
    pauseMutation.mutate(targetTypeId);
  };

  return (
    <>
      <form
        onSubmit={handleSubmit((values) => updateMutation.mutate(values))}
        className="glass-card space-y-4 p-6"
      >
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-600 dark:text-slate-400">
            Name
          </label>
          <input
            {...register('name')}
            className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm outline-none focus:border-neon-blue"
          />
          {errors.name && <p className="mt-1 text-xs text-red-400">{errors.name.message}</p>}
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-slate-600 dark:text-slate-400">
            Description
          </label>
          <input
            {...register('description')}
            className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm outline-none focus:border-neon-blue"
          />
        </div>

        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            {...register('autoActivate')}
            className="rounded border-white/10 bg-white/5"
          />
          Auto-activate new memberships of this type
        </label>

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

          {membershipType.isPaused ? (
            <button
              type="button"
              onClick={() => resumeMutation.mutate()}
              disabled={resumeMutation.isPending}
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-green-500/30 bg-green-500/10 px-4 py-2 text-sm font-medium text-green-400 transition-colors hover:bg-green-500/20"
            >
              {resumeMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <PlayCircle className="h-4 w-4" />
              )}
              Resume
            </button>
          ) : (
            <button
              type="button"
              onClick={() => {
                setTargetTypeId('');
                setIsPauseModalOpen(true);
              }}
              disabled={pauseMutation.isPending}
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-2 text-sm font-medium text-amber-400 transition-colors hover:bg-amber-500/20"
            >
              <PauseCircle className="h-4 w-4" />
              Pause
            </button>
          )}
        </div>
      </form>

      {isPauseModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-md rounded-2xl border border-white/10 bg-slate-900 p-6 shadow-xl">
            <div className="flex items-start gap-3">
              <AlertTriangle className="mt-0.5 h-5 w-5 text-amber-400" />
              <div>
                <h3 className="text-lg font-semibold">Pause membership type</h3>
                <p className="mt-1 text-sm text-slate-400">
                  Pausing <strong>{membershipType.name}</strong> will hide it from public sign-up
                  and move all existing members to the replacement type you choose below.
                </p>
              </div>
            </div>

            <div className="mt-5">
              <label className="mb-1 block text-sm font-medium text-slate-300">
                Convert members to
              </label>
              <select
                value={targetTypeId}
                onChange={(e) => setTargetTypeId(e.target.value)}
                className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm outline-none focus:border-neon-blue"
              >
                <option value="">Select a membership type</option>
                {targetTypes.map((type) => (
                  <option key={type.id} value={type.id}>
                    {type.name} ({type.isFree || type.price === 0 ? 'Free' : `£${type.price}`})
                  </option>
                ))}
              </select>
              {targetTypes.length === 0 && (
                <p className="mt-2 text-xs text-red-400">
                  No other active membership types are available. Create one first.
                </p>
              )}
            </div>

            {pauseMutation.isError && (
              <p className="mt-4 text-sm text-red-400">{getApiErrorMessage(pauseMutation.error)}</p>
            )}

            <div className="mt-6 flex gap-3">
              <button
                type="button"
                onClick={() => setIsPauseModalOpen(false)}
                className="flex-1 rounded-xl border border-white/10 px-4 py-2 text-sm font-medium transition-colors hover:bg-white/5"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handlePause}
                disabled={!targetTypeId || pauseMutation.isPending}
                className="flex-1 rounded-xl bg-amber-500 px-4 py-2 text-sm font-medium text-slate-950 transition-colors hover:bg-amber-400 disabled:opacity-50"
              >
                {pauseMutation.isPending ? (
                  <Loader2 className="mx-auto h-4 w-4 animate-spin" />
                ) : (
                  'Pause & convert'
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
