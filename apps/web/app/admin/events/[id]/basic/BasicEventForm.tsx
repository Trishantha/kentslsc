'use client';

import { useEffect } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Loader2, Save, Trash2, Sparkles, Gift, XCircle } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { formatDate } from '@/lib/utils';
import { ImageUpload } from '@/components/ui/ImageUpload';
import { RichTextEditor } from '@/components/ui/RichTextEditor';
import { EventCategory, EventRegistrationMode, eventCategoryLabels, eventRegistrationModeLabels } from '@kentslsc/shared';
import type { AdminEvent } from '../../page';

const eventSchema = z.object({
  title: z.string().min(1),
  description: z.string().optional(),
  location: z.string().optional(),
  startDatetime: z.string().min(1),
  endDatetime: z.string().min(1),
  ticketPrice: z.coerce.number().min(0).default(0),
  isFree: z.boolean().default(false),
  limited: z.boolean().default(false),
  maxTickets: z.coerce.number().int().min(1).optional(),
  category: z.nativeEnum(EventCategory).default(EventCategory.OTHER),
  registrationMode: z.nativeEnum(EventRegistrationMode).default(EventRegistrationMode.TICKETED),
  imageUrl: z.string().url().optional().or(z.literal('')),
  externalTicketingUrl: z.string().url().optional().or(z.literal('')),
  isPublished: z.boolean().default(false)
});

type EventForm = z.infer<typeof eventSchema>;

interface BasicEventFormProps {
  event: AdminEvent;
  eventId: string;
}

export function BasicEventForm({ event, eventId }: BasicEventFormProps) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { register, control, handleSubmit, reset, setValue, watch, formState: { errors } } = useForm<EventForm>({
    resolver: zodResolver(eventSchema),
    defaultValues: {
      title: event.title,
      description: event.description ?? '',
      location: event.location ?? '',
      startDatetime: new Date(event.startDatetime).toISOString().slice(0, 16),
      endDatetime: new Date(event.endDatetime).toISOString().slice(0, 16),
      ticketPrice: event.isFree ? 0 : Number(event.ticketPrice),
      isFree: event.isFree,
      limited: event.maxTickets != null,
      maxTickets: event.maxTickets ?? undefined,
      category: event.category ?? EventCategory.OTHER,
      registrationMode: event.registrationMode ?? EventRegistrationMode.TICKETED,
      imageUrl: event.imageUrl ?? '',
      externalTicketingUrl: event.externalTicketingUrl ?? '',
      isPublished: event.isPublished
    }
  });
  const isFree = watch('isFree');
  const isEnrollment = watch('registrationMode') === EventRegistrationMode.ENROLLMENT;
  const limited = watch('limited');

  useEffect(() => {
    reset({
      title: event.title,
      description: event.description ?? '',
      location: event.location ?? '',
      startDatetime: new Date(event.startDatetime).toISOString().slice(0, 16),
      endDatetime: new Date(event.endDatetime).toISOString().slice(0, 16),
      ticketPrice: event.isFree ? 0 : Number(event.ticketPrice),
      isFree: event.isFree,
      limited: event.maxTickets != null,
      maxTickets: event.maxTickets ?? undefined,
      category: event.category ?? EventCategory.OTHER,
      registrationMode: event.registrationMode ?? EventRegistrationMode.TICKETED,
      imageUrl: event.imageUrl ?? '',
      externalTicketingUrl: event.externalTicketingUrl ?? '',
      isPublished: event.isPublished
    });
  }, [event, reset]);

  const updateMutation = useMutation({
    mutationFn: async (values: Omit<EventForm, 'maxTickets' | 'limited'> & { maxTickets?: number | null }) => {
      const res = await api.put(`/events/${eventId}`, values);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'events'] });
      queryClient.invalidateQueries({ queryKey: ['admin', 'event', eventId] });
    }
  });

  const deleteMutation = useMutation({
    mutationFn: async () => {
      await api.delete(`/events/${eventId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'events'] });
      router.push('/admin/events');
    }
  });

  const featureFreeMutation = useMutation({
    mutationFn: async () => {
      const res = await api.post(`/admin/events/${eventId}/feature-free`);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'events'] });
      queryClient.invalidateQueries({ queryKey: ['admin', 'event', eventId] });
      router.refresh();
    }
  });

  const unfeatureMutation = useMutation({
    mutationFn: async () => {
      await api.delete(`/admin/events/${eventId}/feature`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'events'] });
      queryClient.invalidateQueries({ queryKey: ['admin', 'event', eventId] });
      router.refresh();
    }
  });

  return (
    <form onSubmit={handleSubmit((formValues) => {
      const { limited: isLimited, maxTickets, ...rest } = formValues;
      updateMutation.mutate({
        ...rest,
        // Unchecking "limited" clears the capacity cap; the API stores null for unlimited.
        maxTickets: (isLimited ? (maxTickets ?? undefined) : null) as number | null,
        ...(isEnrollment ? { isFree: true, ticketPrice: 0 } : {})
      });
    })} className="glass-card space-y-4 p-6">
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
      <div>
        <label className="mb-1 block text-sm font-medium text-slate-600 dark:text-slate-400">Registration</label>
        <select {...register('registrationMode')} className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm outline-none focus:border-neon-blue">
          {Object.values(EventRegistrationMode).map((mode) => (
            <option key={mode} value={mode}>
              {eventRegistrationModeLabels[mode]}
            </option>
          ))}
        </select>
        <p className="mt-1 text-xs text-slate-500">
          Workshops use enrollment: visitors enroll for free instead of buying tickets.
        </p>
      </div>
      {!isEnrollment && (
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
      )}
      {!isEnrollment && (
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
      )}
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" {...register('limited')} className="rounded border-white/10 bg-white/5" />
        Limited capacity
      </label>
      {limited && (
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-600 dark:text-slate-400">{isEnrollment ? 'Max participants' : 'Max tickets'}</label>
          <input type="number" {...register('maxTickets')} className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm outline-none focus:border-neon-blue" />
        </div>
      )}
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
        <label className="mb-1 block text-sm font-medium text-slate-600 dark:text-slate-400">
          {isEnrollment ? 'External registration URL' : 'External ticketing URL'}
        </label>
        <input
          {...register('externalTicketingUrl')}
          placeholder={isEnrollment ? 'https://example.com/register' : 'https://example.com/tickets'}
          className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm outline-none focus:border-neon-blue"
        />
        {errors.externalTicketingUrl && (
          <p className="mt-1 text-xs text-red-400">{errors.externalTicketingUrl.message}</p>
        )}
        <p className="mt-1 text-xs text-slate-500">
          {isEnrollment
            ? 'If set, visitors are redirected here to enroll instead of registering on this site.'
            : 'If set, visitors are redirected here to buy tickets instead of using the built-in checkout.'}
        </p>
      </div>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" {...register('isPublished')} className="rounded border-white/10 bg-white/5" />
        Published
      </label>

      <div className="rounded-xl border border-white/10 bg-white/5 p-4">
        <div className="mb-3 flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-neon-gold" />
          <h3 className="text-sm font-semibold">Featuring</h3>
        </div>

        <div className="space-y-3 text-sm">
          <div className="flex items-center justify-between">
            <span className="text-slate-500">Featured</span>
            <span className={event.isFeatured ? 'text-green-400' : 'text-slate-400'}>
              {event.isFeatured ? 'Yes' : 'No'}
            </span>
          </div>
          {event.isFeatured && event.featuredUntil && (
            <div className="flex items-center justify-between">
              <span className="text-slate-500">Featured until</span>
              <span className="text-slate-300">{formatDate(event.featuredUntil)}</span>
            </div>
          )}
          <div className="flex items-center justify-between">
            <span className="text-slate-500">Payment</span>
            <span className="text-slate-300">
              {event.isFeatured ? (
                <span className="inline-flex items-center gap-1 text-neon-blue">
                  <Gift className="h-3 w-3" /> Free / goodwill
                </span>
              ) : (
                'Not featured'
              )}
            </span>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => featureFreeMutation.mutate()}
            disabled={featureFreeMutation.isPending}
            className="inline-flex items-center gap-1.5 rounded-lg bg-neon-blue/10 px-3 py-2 text-xs font-semibold text-neon-blue hover:bg-neon-blue/20 disabled:opacity-60"
          >
            {featureFreeMutation.isPending ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <Gift className="h-3 w-3" />
            )}
            Feature free (goodwill)
          </button>
          {event.isFeatured && (
            <button
              type="button"
              onClick={() => {
                if (confirm('Remove the feature from this event?')) {
                  unfeatureMutation.mutate();
                }
              }}
              disabled={unfeatureMutation.isPending}
              className="inline-flex items-center gap-1.5 rounded-lg bg-red-500/10 px-3 py-2 text-xs font-semibold text-red-400 hover:bg-red-500/20 disabled:opacity-60"
            >
              {unfeatureMutation.isPending ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <XCircle className="h-3 w-3" />
              )}
              Remove feature
            </button>
          )}
        </div>
      </div>
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
            if (confirm('Are you sure you want to delete this event?')) {
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
