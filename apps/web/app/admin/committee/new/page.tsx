'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Loader2, ArrowLeft, Plus } from 'lucide-react';
import Link from 'next/link';
import { api } from '@/lib/api';
import { ImageUpload } from '@/components/ui/ImageUpload';
import { revalidateCommitteePages } from '../actions';

const committeeSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  position: z.string().min(1, 'Position is required'),
  roleKey: z.string().min(1, 'Role key is required'),
  photoUrl: z.string().url('Enter a valid image URL').optional().or(z.literal('')),
  displayOrder: z.coerce.number().int().min(0, 'Display order must be 0 or greater').default(0)
});

type CommitteeForm = z.infer<typeof committeeSchema>;

export default function NewCommitteeMemberPage() {
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
      name: '',
      position: '',
      roleKey: '',
      photoUrl: '',
      displayOrder: 0
    }
  });

  const createMutation = useMutation({
    mutationFn: async (values: CommitteeForm) => {
      const res = await api.post('/admin/committee', {
        ...values,
        photoUrl: values.photoUrl || undefined
      });
      return res.data as { id: string };
    },
    onSuccess: async (data) => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'committee'] });
      try {
        await revalidateCommitteePages();
      } catch {
        // Revalidation failure is non-fatal; the list will refresh from the API.
      }
      router.push(`/admin/committee/${data.id}/details`);
    }
  });

  return (
    <div>
      <div className="flex items-center gap-3">
        <Link
          href="/admin/committee"
          className="rounded-lg p-2 text-slate-500 hover:bg-white/5 hover:text-slate-300"
        >
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div>
          <h1 className="section-title">Create committee member</h1>
          <p className="text-sm text-slate-500">Add a new committee member to the website.</p>
        </div>
      </div>

      <div className="mt-6 max-w-2xl">
        <form
          onSubmit={handleSubmit((values) => createMutation.mutate(values))}
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

          {createMutation.isError && (
            <p className="text-sm text-red-400">
              {createMutation.error instanceof Error ? createMutation.error.message : 'Failed to create member.'}
            </p>
          )}

          <div className="flex gap-3 pt-2">
            <button type="submit" disabled={createMutation.isPending} className="btn-primary flex-1">
              {createMutation.isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Plus className="mr-2 h-4 w-4" />
              )}
              Create member
            </button>
            <Link
              href="/admin/committee"
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
