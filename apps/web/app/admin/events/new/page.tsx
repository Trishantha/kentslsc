'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Loader2, ArrowLeft, Plus } from 'lucide-react';
import Link from 'next/link';
import { api } from '@/lib/api';
import { ImageUpload } from '@/components/ui/ImageUpload';
import { RichTextEditor } from '@/components/ui/RichTextEditor';
import { EventCategory, eventCategoryLabels } from '@kentslsc/shared';

const eventSchema = z.object({
  title: z.string().min(1),
  description: z.string().optional(),
  location: z.string().optional(),
  startDatetime: z.string().min(1),
  endDatetime: z.string().min(1),
  ticketPrice: z.coerce.number().min(0).default(0),
  isFree: z.boolean().default(false),
  maxTickets: z.coerce.number().int().min(1).optional(),
  category: z.nativeEnum(EventCategory).default(EventCategory.OTHER),
  imageUrl: z.string().url().optional().or(z.literal('')),
  externalTicketingUrl: z.string().url().optional().or(z.literal('')),
  isPublished: z.boolean().default(false)
});

type EventForm = z.infer<typeof eventSchema>;

export default function NewEventPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { register, control, handleSubmit, reset, setValue, watch, formState: { errors } } = useForm<EventForm>({
    resolver: zodResolver(eventSchema),
    defaultValues: {
      ticketPrice: 0,
      isFree: false,
      isPublished: false,
      category: EventCategory.OTHER
    }
  });
  const isFree = watch('isFree');

  const createMutation = useMutation({
    mutationFn: async (values: EventForm) => {
      const res = await api.post('/events', values);
      return res.data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'events'] });
      router.push(`/admin/events/${data.id}/basic`);
    }
  });

  return (
    <div>
      <div className="flex items-center gap-3">
        <Link
          href="/admin/events"
          className="rounded-lg p-2 text-slate-500 hover:bg-white/5 hover:text-slate-300"
        >
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div>
          <h1 className="section-title">Create event</h1>
          <p className="text-sm text-slate-500">Set up the basic details first, then add posters and ticket design.</p>
        </div>
      </div>

      <div className="mt-6 max-w-2xl">
        <form onSubmit={handleSubmit((values) => createMutation.mutate(values))} className="glass-card space-y-4 p-6">
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-600 dark:text-slate-400">Title</label>
            <input {...register('title')} className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm outline-none focus:border-neon-blue" />
            {errors.title && <p className="mt-1 text-xs text-red-400">{errors.title.message}</p>}
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-600 dark:text-slate-400">Description</label>
            <Controller
              name="description"
              control={control}
              render={({ field }) => (
                <RichTextEditor
                  value={field.value ?? ''}
                  onChange={field.onChange}
                  placeholder="Write a full event description with formatting"
                  minHeightClassName="min-h-[150px]"
                />
              )}
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-600 dark:text-slate-400">Location</label>
            <input {...register('location')} className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm outline-none focus:border-neon-blue" />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-600 dark:text-slate-400">Start</label>
              <input type="datetime-local" {...register('startDatetime')} className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm outline-none focus:border-neon-blue" />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-600 dark:text-slate-400">End</label>
              <input type="datetime-local" {...register('endDatetime')} className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm outline-none focus:border-neon-blue" />
            </div>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              {...register('isFree', {
                onChange: (e) => {
                  if (e.target.checked) {
                    setValue('ticketPrice', 0);
                  }
                }
              })}
              className="rounded border-white/10 bg-white/5"
            />
            Free event
          </label>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-600 dark:text-slate-400">Ticket price (£)</label>
              <input
                type="number"
                step="0.01"
                disabled={isFree}
                {...register('ticketPrice')}
                className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm outline-none focus:border-neon-blue disabled:opacity-50"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-600 dark:text-slate-400">Max tickets</label>
              <input type="number" {...register('maxTickets')} className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm outline-none focus:border-neon-blue" />
            </div>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-600 dark:text-slate-400">Category</label>
            <select {...register('category')} className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm outline-none focus:border-neon-blue">
              {Object.values(EventCategory).map((cat) => (
                <option key={cat} value={cat}>
                  {eventCategoryLabels[cat]}
                </option>
              ))}
            </select>
            {errors.category && <p className="mt-1 text-xs text-red-400">{errors.category.message}</p>}
          </div>
          <ImageUpload
            label="Cover image"
            value={watch('imageUrl')}
            onChange={(url) => setValue('imageUrl', url, { shouldValidate: true })}
            hideUrlInput
          />
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-600 dark:text-slate-400">External ticketing URL</label>
            <input
              {...register('externalTicketingUrl')}
              placeholder="https://example.com/tickets"
              className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm outline-none focus:border-neon-blue"
            />
            {errors.externalTicketingUrl && (
              <p className="mt-1 text-xs text-red-400">{errors.externalTicketingUrl.message}</p>
            )}
            <p className="mt-1 text-xs text-slate-500">If set, visitors are redirected here to buy tickets instead of using the built-in checkout.</p>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" {...register('isPublished')} className="rounded border-white/10 bg-white/5" />
            Published
          </label>
          <div className="flex gap-3 pt-2">
            <button type="submit" disabled={createMutation.isPending} className="btn-primary flex-1">
              {createMutation.isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Plus className="mr-2 h-4 w-4" />
              )}
              Create event
            </button>
            <Link
              href="/admin/events"
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
