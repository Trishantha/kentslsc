'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Loader2, Megaphone, Plus } from 'lucide-react';
import { api } from '@/lib/api';
import { RichTextEditor } from '@/components/ui/RichTextEditor';
import { RichTextContent } from '@/components/ui/RichTextContent';
import { hasRichTextContent } from '@/lib/rich-text';
import { formatDate } from '@/lib/utils';
import type { FundraiserUpdate } from '../../types';

const updateSchema = z.object({
  title: z.string().min(1),
  content: z.string().refine((value) => hasRichTextContent(value), 'Update content is required')
});

type UpdateForm = z.infer<typeof updateSchema>;

interface FundraiserUpdatesManagerProps {
  fundraiserId: string;
}

export function FundraiserUpdatesManager({ fundraiserId }: FundraiserUpdatesManagerProps) {
  const queryClient = useQueryClient();
  const { register, control, handleSubmit, reset, formState: { errors } } = useForm<UpdateForm>({
    resolver: zodResolver(updateSchema),
    defaultValues: { title: '', content: '' }
  });

  const { data: updates, isLoading } = useQuery<FundraiserUpdate[]>({
    queryKey: ['fundraiser', fundraiserId, 'updates'],
    queryFn: async () => {
      const res = await api.get(`/fundraisers/${fundraiserId}/updates`);
      return res.data;
    }
  });

  const addUpdateMutation = useMutation({
    mutationFn: async (dto: UpdateForm) => {
      const res = await api.post(`/admin/fundraisers/${fundraiserId}/updates`, dto);
      return res.data;
    },
    onSuccess: () => {
      reset({ title: '', content: '' });
      queryClient.invalidateQueries({ queryKey: ['fundraiser', fundraiserId, 'updates'] });
      queryClient.invalidateQueries({ queryKey: ['admin', 'fundraiser', fundraiserId] });
    }
  });

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <div className="glass-card p-6 lg:col-span-1">
        <h2 className="mb-4 text-lg font-bold">Post update</h2>
        <form
          onSubmit={handleSubmit((dto) => addUpdateMutation.mutate(dto))}
          className="space-y-4"
        >
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-600 dark:text-slate-400">Title *</label>
            <input
              {...register('title')}
              className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm outline-none focus:border-neon-blue"
            />
            {errors.title && <p className="mt-1 text-xs text-red-400">{errors.title.message}</p>}
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-600 dark:text-slate-400">Content *</label>
            <Controller
              name="content"
              control={control}
              render={({ field }) => (
                <RichTextEditor
                  value={field.value}
                  onChange={field.onChange}
                  placeholder="Share campaign progress, milestones, or thank-you notes"
                  minHeightClassName="min-h-[180px]"
                />
              )}
            />
            {errors.content && <p className="mt-1 text-xs text-red-400">{errors.content.message}</p>}
          </div>
          <button
            type="submit"
            disabled={addUpdateMutation.isPending}
            className="btn-primary w-full"
          >
            {addUpdateMutation.isPending ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Plus className="mr-2 h-4 w-4" />
            )}
            Post update
          </button>
        </form>
      </div>

      <div className="glass-card p-6 lg:col-span-2">
        <h2 className="mb-4 text-lg font-bold">Updates</h2>

        {isLoading ? (
          <div className="flex h-40 items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-neon-blue" />
          </div>
        ) : !updates?.length ? (
          <div className="py-8 text-center text-slate-500">No updates yet.</div>
        ) : (
          <ul className="space-y-4">
            {updates.map((u) => (
              <li key={u.id} className="rounded-xl border border-white/10 bg-white/5 p-5">
                <div className="mb-2 flex items-center gap-2">
                  <div className="flex h-7 w-7 items-center justify-center rounded-full bg-neon-blue/20">
                    <Megaphone className="h-3.5 w-3.5 text-neon-blue" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold">{u.title}</p>
                    <p className="text-xs text-slate-400">
                      {u.author?.firstName ?? u.author?.name} · {formatDate(u.createdAt)}
                    </p>
                  </div>
                </div>
                <RichTextContent html={u.content} className="text-sm text-slate-600 dark:text-slate-400" />
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
