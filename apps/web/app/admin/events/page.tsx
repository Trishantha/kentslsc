'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { motion, AnimatePresence } from 'framer-motion';
import { Loader2, Plus, Pencil, Trash2, X } from 'lucide-react';
import { api } from '@/lib/api';
import { ImageUpload } from '@/components/ui/ImageUpload';

const eventSchema = z.object({
  title: z.string().min(1),
  description: z.string().optional(),
  location: z.string().optional(),
  startDatetime: z.string().min(1),
  endDatetime: z.string().min(1),
  ticketPrice: z.coerce.number().min(0).default(0),
  maxTickets: z.coerce.number().int().min(1).optional(),
  imageUrl: z.string().url().optional().or(z.literal('')),
  isPublished: z.boolean().default(false)
});

type EventForm = z.infer<typeof eventSchema>;

interface Event {
  id: string;
  title: string;
  description: string | null;
  location: string | null;
  startDatetime: string;
  endDatetime: string;
  ticketPrice: number;
  maxTickets: number | null;
  imageUrl: string | null;
  isPublished: boolean;
}

export default function AdminEventsPage() {
  const [editing, setEditing] = useState<Event | null>(null);
  const queryClient = useQueryClient();
  const { register, handleSubmit, reset, setValue, watch, formState: { errors } } = useForm<EventForm>({
    resolver: zodResolver(eventSchema),
    defaultValues: {
      ticketPrice: 0,
      isPublished: false
    }
  });

  const { data, isLoading } = useQuery<{ data: Event[] }>({
    queryKey: ['admin', 'events'],
    queryFn: async () => {
      const res = await api.get('/admin/events');
      return res.data;
    }
  });

  const createMutation = useMutation({
    mutationFn: async (values: EventForm) => {
      const res = await api.post('/admin/events', values);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'events'] });
      reset();
    }
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, values }: { id: string; values: EventForm }) => {
      const res = await api.put(`/admin/events/${id}`, values);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'events'] });
      setEditing(null);
      reset();
    }
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/admin/events/${id}`);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin', 'events'] })
  });

  const onSubmit = (values: EventForm) => {
    if (editing) {
      updateMutation.mutate({ id: editing.id, values });
    } else {
      createMutation.mutate(values);
    }
  };

  const startEdit = (event: Event) => {
    setEditing(event);
    reset({
      title: event.title,
      description: event.description ?? '',
      location: event.location ?? '',
      startDatetime: new Date(event.startDatetime).toISOString().slice(0, 16),
      endDatetime: new Date(event.endDatetime).toISOString().slice(0, 16),
      ticketPrice: event.ticketPrice,
      maxTickets: event.maxTickets ?? undefined,
      imageUrl: event.imageUrl ?? '',
      isPublished: event.isPublished
    });
  };

  const clearEdit = () => {
    setEditing(null);
    reset({
      title: '',
      description: '',
      location: '',
      startDatetime: '',
      endDatetime: '',
      ticketPrice: 0,
      maxTickets: undefined,
      imageUrl: '',
      isPublished: false
    });
  };

  return (
    <div>
      <h1 className="section-title">Events</h1>
      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <div className="glass-card p-6 lg:col-span-1">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-bold">{editing ? 'Edit Event' : 'Create Event'}</h2>
            {editing && (
              <button type="button" onClick={clearEdit} className="text-slate-500 hover:text-slate-300">
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-600 dark:text-slate-400">Title</label>
              <input {...register('title')} className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm outline-none focus:border-neon-blue" />
              {errors.title && <p className="mt-1 text-xs text-red-400">{errors.title.message}</p>}
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-600 dark:text-slate-400">Description</label>
              <textarea {...register('description')} rows={3} className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm outline-none focus:border-neon-blue" />
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
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-600 dark:text-slate-400">Ticket price (£)</label>
                <input type="number" step="0.01" {...register('ticketPrice')} className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm outline-none focus:border-neon-blue" />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-600 dark:text-slate-400">Max tickets</label>
                <input type="number" {...register('maxTickets')} className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm outline-none focus:border-neon-blue" />
              </div>
            </div>
            <ImageUpload
              label="Image"
              value={watch('imageUrl')}
              onChange={(url) => setValue('imageUrl', url, { shouldValidate: true })}
              hideUrlInput
            />
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" {...register('isPublished')} className="rounded border-white/10 bg-white/5" />
              Published
            </label>
            <button type="submit" disabled={createMutation.isPending || updateMutation.isPending} className="btn-primary w-full">
              {createMutation.isPending || updateMutation.isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : editing ? (
                <Pencil className="mr-2 h-4 w-4" />
              ) : (
                <Plus className="mr-2 h-4 w-4" />
              )}
              {editing ? 'Update Event' : 'Create Event'}
            </button>
          </form>
        </div>

        <div className="glass-card p-6 lg:col-span-2">
          {isLoading ? (
            <div className="flex h-40 items-center justify-center">
              <Loader2 className="h-6 w-6 animate-spin text-neon-blue" />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-white/10 text-slate-500 dark:text-slate-400">
                    <th className="py-3 font-medium">Title</th>
                    <th className="py-3 font-medium">Location</th>
                    <th className="py-3 font-medium">Start</th>
                    <th className="py-3 font-medium">Price</th>
                    <th className="py-3 font-medium">Published</th>
                    <th className="py-3 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {data?.data.map((event, idx) => (
                    <motion.tr
                      key={event.id}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: idx * 0.03 }}
                    >
                      <td className="py-3 font-medium">{event.title}</td>
                      <td className="py-3 text-slate-600 dark:text-slate-400">{event.location || '-'}</td>
                      <td className="py-3 text-slate-600 dark:text-slate-400">
                        {new Date(event.startDatetime).toLocaleString('en-GB')}
                      </td>
                      <td className="py-3">£{Number(event.ticketPrice).toFixed(2)}</td>
                      <td className="py-3">
                        <span className={`rounded-full px-2 py-1 text-xs font-semibold ${event.isPublished ? 'bg-green-500/10 text-green-400' : 'bg-slate-500/10 text-slate-400'}`}>
                          {event.isPublished ? 'Yes' : 'No'}
                        </span>
                      </td>
                      <td className="py-3">
                        <div className="flex gap-2">
                          <button onClick={() => startEdit(event)} className="rounded-lg bg-neon-blue/10 p-2 text-neon-blue hover:bg-neon-blue/20">
                            <Pencil className="h-4 w-4" />
                          </button>
                          <button onClick={() => deleteMutation.mutate(event.id)} className="rounded-lg bg-red-500/10 p-2 text-red-400 hover:bg-red-500/20">
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </motion.tr>
                  ))}
                </tbody>
              </table>
              {!data?.data.length && <div className="mt-8 text-center text-slate-500">No events yet.</div>}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
