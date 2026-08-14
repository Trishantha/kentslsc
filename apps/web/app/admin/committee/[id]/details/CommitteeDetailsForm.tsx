'use client';

import { useEffect } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Loader2, Save, Trash2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { ImageUpload } from '@/components/ui/ImageUpload';
import { revalidateCommitteePages } from '../../actions';
import type { AdminCommitteeMember } from '../../page';

const committeeSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  position: z.string().min(1, 'Position is required'),
  roleKey: z.string().min(1, 'Role key is required'),
  photoUrl: z.string().url('Enter a valid image URL').optional().or(z.literal('')),
  displayOrder: z.coerce.number().int().min(0, 'Display order must be 0 or greater').default(0)
});

type CommitteeForm = z.infer<typeof committeeSchema>;

interface CommitteeDetailsFormProps {
  member: AdminCommitteeMember;
  memberId: string;
}

export function CommitteeDetailsForm({ member, memberId }: CommitteeDetailsFormProps) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors }
  } = useForm<CommitteeForm>({
    resolver: zodResolver(committeeSchema),
    defaultValues: {
      name: member.name,
      position: member.position,
      roleKey: member.roleKey,
      photoUrl: member.photoUrl ?? '',
      displayOrder: member.displayOrder
    }
  });

  useEffect(() => {
    reset({
      name: member.name,
      position: member.position,
      roleKey: member.roleKey,
      photoUrl: member.photoUrl ?? '',
      displayOrder: member.displayOrder
    });
  }, [member, reset]);

  const updateMutation = useMutation({
    mutationFn: async (values: CommitteeForm) => {
      const res = await api.put(`/admin/committee/${memberId}`, {
        ...values,
        photoUrl: values.photoUrl || undefined
      });
      return res.data;
    },
    onSuccess: async () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'committee'] });
      queryClient.invalidateQueries({ queryKey: ['admin', 'committee', memberId] });
      try {
        await revalidateCommitteePages();
      } catch {
        // Revalidation failure is non-fatal.
      }
    }
  });

  const deleteMutation = useMutation({
    mutationFn: async () => {
      await api.delete(`/admin/committee/${memberId}`);
    },
    onSuccess: async () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'committee'] });
      try {
        await revalidateCommitteePages();
      } catch {
        // Revalidation failure is non-fatal.
      }
      router.push('/admin/committee');
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
          Position
        </label>
        <input
          {...register('position')}
          className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm outline-none focus:border-neon-blue"
        />
        {errors.position && <p className="mt-1 text-xs text-red-400">{errors.position.message}</p>}
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium text-slate-600 dark:text-slate-400">
          Role key
        </label>
        <input
          {...register('roleKey')}
          placeholder="president"
          className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm outline-none focus:border-neon-blue"
        />
        {errors.roleKey && <p className="mt-1 text-xs text-red-400">{errors.roleKey.message}</p>}
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium text-slate-600 dark:text-slate-400">
          Display order
        </label>
        <input
          type="number"
          min={0}
          {...register('displayOrder')}
          className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm outline-none focus:border-neon-blue"
        />
        {errors.displayOrder && (
          <p className="mt-1 text-xs text-red-400">{errors.displayOrder.message}</p>
        )}
      </div>

      <ImageUpload
        label="Photo"
        value={watch('photoUrl')}
        onChange={(url) => setValue('photoUrl', url, { shouldValidate: true })}
        hideUrlInput
      />

      {updateMutation.isError && (
        <p className="text-sm text-red-400">
          {updateMutation.error instanceof Error ? updateMutation.error.message : 'Failed to update member.'}
        </p>
      )}

      <div className="flex gap-3 pt-2">
        <button type="submit" disabled={updateMutation.isPending} className="btn-primary flex-1">
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
            if (confirm('Are you sure you want to delete this committee member?')) {
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
