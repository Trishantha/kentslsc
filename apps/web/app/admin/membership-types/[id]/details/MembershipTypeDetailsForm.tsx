'use client';

import { useEffect } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Loader2, Save, Trash2 } from 'lucide-react';
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

  const deleteMutation = useMutation({
    mutationFn: async () => {
      await api.delete(`/membership/types/${membershipType.id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'membership-types'] });
      queryClient.invalidateQueries({ queryKey: ['membership-types'] });
      router.push('/admin/membership-types');
    }
  });

  return (
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
        <button
          type="button"
          onClick={() => {
            if (confirm('Are you sure you want to delete this membership type?')) {
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
