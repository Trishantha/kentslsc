'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { motion } from 'framer-motion';
import {
  Loader2, Plus, Pencil, Trash2, X, HeartHandshake,
  CheckCircle2, XCircle, Clock, TrendingUp, Users, WifiOff
} from 'lucide-react';
import { api } from '@/lib/api';
import { ImageUpload } from '@/components/ui/ImageUpload';
import { RichTextEditor } from '@/components/ui/RichTextEditor';
import { hasRichTextContent } from '@/lib/rich-text';

const CATEGORIES = [
  { value: 'CHARITY', label: 'Charity' },
  { value: 'SPORTS', label: 'Sports' },
  { value: 'COMMUNITY', label: 'Community' },
  { value: 'MEMORIAL', label: 'Memorial' },
  { value: 'MEDICAL', label: 'Medical' },
  { value: 'OTHER', label: 'Other' }
];

const fundraiserSchema = z.object({
  title: z.string().min(1),
  description: z.string().optional(),
  targetAmount: z.coerce.number().min(0),
  category: z.string().default('CHARITY'),
  imageUrl: z.string().optional().or(z.literal('')),
  imagePath: z.string().optional(),
  startDate: z.string().min(1),
  endDate: z.string().min(1),
  isActive: z.boolean().default(true)
});

const offlineDonationSchema = z.object({
  amount: z.coerce.number().min(0.01),
  displayName: z.string().optional(),
  message: z.string().optional()
});

const fundraiserUpdateSchema = z.object({
  title: z.string().min(1),
  content: z.string().refine((value) => hasRichTextContent(value), 'Update content is required')
});

type FundraiserForm = z.infer<typeof fundraiserSchema>;
type OfflineDonationForm = z.infer<typeof offlineDonationSchema>;
type FundraiserUpdateForm = z.infer<typeof fundraiserUpdateSchema>;

interface Fundraiser {
  id: string;
  title: string;
  description: string | null;
  targetAmount: number;
  raisedAmount: number;
  totalDonors: number;
  imageUrl: string | null;
  imagePath: string | null;
  startDate: string;
  endDate: string;
  isActive: boolean;
  status: string;
  category: string;
  rejectionReason?: string | null;
  organizer?: { name: string } | null;
}

interface Stats { activeCampaigns: number; pendingCount: number; totalRaised: number; totalDonors: number }

const STATUS_COLORS: Record<string, string> = {
  ACTIVE: 'bg-green-500/10 text-green-400',
  PENDING_APPROVAL: 'bg-amber-500/10 text-amber-400',
  REJECTED: 'bg-red-500/10 text-red-400',
  COMPLETED: 'bg-slate-500/10 text-slate-400'
};

export default function AdminFundraisersPage() {
  const [tab, setTab] = useState<'all' | 'pending'>('all');
  const [editing, setEditing] = useState<Fundraiser | null>(null);
  const [offlineFundraiser, setOfflineFundraiser] = useState<Fundraiser | null>(null);
  const [updateTarget, setUpdateTarget] = useState<Fundraiser | null>(null);
  const [rejectTarget, setRejectTarget] = useState<{ id: string; reason: string } | null>(null);
  const queryClient = useQueryClient();

  const { register, control, handleSubmit, reset, setValue, watch, formState: { errors } } = useForm<FundraiserForm>({
    resolver: zodResolver(fundraiserSchema),
    defaultValues: { targetAmount: 0, isActive: true, category: 'CHARITY' }
  });

  const offlineForm = useForm<OfflineDonationForm>({
    resolver: zodResolver(offlineDonationSchema),
    defaultValues: { amount: 0 }
  });

  const updateForm = useForm<FundraiserUpdateForm>({
    resolver: zodResolver(fundraiserUpdateSchema),
    defaultValues: { title: '', content: '' }
  });

  const { data: stats } = useQuery<Stats>({
    queryKey: ['admin', 'fundraisers', 'stats'],
    queryFn: async () => (await api.get('/admin/fundraisers/stats')).data
  });

  const { data, isLoading } = useQuery<{ items: Fundraiser[]; total: number }>({
    queryKey: ['admin', 'fundraisers', tab],
    queryFn: async () => {
      if (tab === 'pending') return { items: await api.get('/admin/fundraisers/pending').then(r => r.data), total: 0 };
      return api.get('/admin/fundraisers').then(r => r.data);
    }
  });

  const createMutation = useMutation({
    mutationFn: async (values: FundraiserForm) => (await api.post('/admin/fundraisers', { ...values, imageUrl: values.imageUrl || undefined, imagePath: values.imagePath || undefined })).data,
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['admin', 'fundraisers'] }); reset(); }
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, values }: { id: string; values: FundraiserForm }) =>
      (await api.put(`/admin/fundraisers/${id}`, { ...values, imageUrl: values.imageUrl || undefined, imagePath: values.imagePath || undefined })).data,
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['admin', 'fundraisers'] }); setEditing(null); reset(); }
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => { await api.delete(`/admin/fundraisers/${id}`); },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin', 'fundraisers'] })
  });

  const approveMutation = useMutation({
    mutationFn: async (id: string) => (await api.post(`/admin/fundraisers/${id}/approve`)).data,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin', 'fundraisers'] })
  });

  const rejectMutation = useMutation({
    mutationFn: async ({ id, reason }: { id: string; reason?: string }) =>
      (await api.post(`/admin/fundraisers/${id}/reject`, { reason })).data,
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['admin', 'fundraisers'] }); setRejectTarget(null); }
  });

  const offlineMutation = useMutation({
    mutationFn: async ({ id, dto }: { id: string; dto: OfflineDonationForm }) =>
      (await api.post(`/admin/fundraisers/${id}/offline-donation`, dto)).data,
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['admin', 'fundraisers'] }); setOfflineFundraiser(null); offlineForm.reset(); }
  });

  const addUpdateMutation = useMutation({
    mutationFn: async ({ id, dto }: { id: string; dto: FundraiserUpdateForm }) =>
      (await api.post(`/admin/fundraisers/${id}/updates`, dto)).data,
    onSuccess: () => {
      setUpdateTarget(null);
      updateForm.reset();
      queryClient.invalidateQueries({ queryKey: ['admin', 'fundraisers'] });
    }
  });

  const onSubmit = (values: FundraiserForm) => {
    if (editing) updateMutation.mutate({ id: editing.id, values });
    else createMutation.mutate(values);
  };

  const startEdit = (f: Fundraiser) => {
    setEditing(f);
    reset({
      title: f.title, description: f.description ?? '', targetAmount: f.targetAmount,
      imageUrl: f.imageUrl ?? '', imagePath: f.imagePath ?? '',
      category: f.category,
      startDate: new Date(f.startDate).toISOString().slice(0, 10),
      endDate: new Date(f.endDate).toISOString().slice(0, 10),
      isActive: f.isActive
    });
  };

  const clearEdit = () => {
    setEditing(null);
    reset({ title: '', description: '', targetAmount: 0, imageUrl: '', imagePath: '', category: 'CHARITY', startDate: '', endDate: '', isActive: true });
  };

  const items = data?.items ?? [];

  return (
    <div>
      <h1 className="section-title">Fundraisers</h1>

      {/* Stats row */}
      {stats && (
        <div className="mt-6 grid gap-4 sm:grid-cols-4">
          {[
            { label: 'Active Campaigns', value: stats.activeCampaigns, icon: <HeartHandshake className="h-5 w-5 text-neon-gold" /> },
            { label: 'Pending Review', value: stats.pendingCount, icon: <Clock className="h-5 w-5 text-amber-400" /> },
            { label: 'Total Raised', value: `£${stats.totalRaised.toLocaleString()}`, icon: <TrendingUp className="h-5 w-5 text-neon-blue" /> },
            { label: 'Total Donors', value: stats.totalDonors, icon: <Users className="h-5 w-5 text-slate-400" /> }
          ].map((s) => (
            <div key={s.label} className="glass-card flex items-center gap-3 p-4">
              {s.icon}
              <div>
                <p className="text-xl font-bold">{s.value}</p>
                <p className="text-xs text-slate-500 dark:text-slate-400">{s.label}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        {/* Form panel */}
        <div className="glass-card p-6 lg:col-span-1">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-bold">{editing ? 'Edit Campaign' : 'Create Campaign'}</h2>
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
              <Controller
                name="description"
                control={control}
                render={({ field }) => (
                  <RichTextEditor
                    value={field.value ?? ''}
                    onChange={field.onChange}
                    placeholder="Describe the campaign with formatted content"
                    minHeightClassName="min-h-[160px]"
                  />
                )}
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-600 dark:text-slate-400">Category</label>
              <select {...register('category')} className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm outline-none focus:border-neon-blue">
                {CATEGORIES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-600 dark:text-slate-400">Target (£)</label>
              <input type="number" step="0.01" {...register('targetAmount')} className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm outline-none focus:border-neon-blue" />
            </div>
            <ImageUpload
              label="Campaign Image"
              value={watch('imageUrl')}
              onChange={(url, path) => {
                setValue('imageUrl', url, { shouldValidate: true });
                if (path) setValue('imagePath', path, { shouldValidate: true });
              }}
              hideUrlInput
              showPreview
            />
            <div className="grid gap-2">
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-600 dark:text-slate-400">Start date</label>
                <input type="date" {...register('startDate')} className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm outline-none focus:border-neon-blue" />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-600 dark:text-slate-400">End date</label>
                <input type="date" {...register('endDate')} className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm outline-none focus:border-neon-blue" />
              </div>
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" {...register('isActive')} className="rounded border-white/10 bg-white/5" />
              Active
            </label>
            <button type="submit" disabled={createMutation.isPending || updateMutation.isPending} className="btn-primary w-full">
              {(createMutation.isPending || updateMutation.isPending) ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : editing ? <Pencil className="mr-2 h-4 w-4" /> : <Plus className="mr-2 h-4 w-4" />}
              {editing ? 'Update Campaign' : 'Create Campaign'}
            </button>
          </form>
        </div>

        {/* Table panel */}
        <div className="glass-card p-6 lg:col-span-2">
          {/* Tabs */}
          <div className="mb-4 flex gap-2">
            {(['all', 'pending'] as const).map((t) => (
              <button key={t} onClick={() => setTab(t)} className={`rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${tab === t ? 'bg-neon-blue text-white' : 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300'}`}>
                {t === 'all' ? 'All Campaigns' : `Pending Review${stats?.pendingCount ? ` (${stats.pendingCount})` : ''}`}
              </button>
            ))}
          </div>

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
                    <th className="py-3 font-medium">Target / Raised</th>
                    <th className="py-3 font-medium">Status</th>
                    <th className="py-3 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {items.map((f, idx) => (
                    <motion.tr key={f.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: idx * 0.03 }}>
                      <td className="py-3">
                        <div className="flex items-center gap-2">
                          <HeartHandshake className="h-4 w-4 shrink-0 text-neon-gold" />
                          <div>
                            <p className="font-medium">{f.title}</p>
                            {f.organizer && <p className="text-xs text-slate-400">by {f.organizer.name}</p>}
                          </div>
                        </div>
                      </td>
                      <td className="py-3">
                        <p>£{Number(f.targetAmount).toFixed(0)}</p>
                        <p className="text-xs text-neon-blue">£{Number(f.raisedAmount).toFixed(0)} raised</p>
                      </td>
                      <td className="py-3">
                        <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${STATUS_COLORS[f.status] ?? STATUS_COLORS.COMPLETED}`}>
                          {f.status.replace('_', ' ')}
                        </span>
                      </td>
                      <td className="py-3">
                        <div className="flex flex-wrap gap-1.5">
                          {f.status === 'PENDING_APPROVAL' && (
                            <>
                              <button onClick={() => approveMutation.mutate(f.id)} disabled={approveMutation.isPending} className="rounded-lg bg-green-500/10 p-2 text-green-400 hover:bg-green-500/20" title="Approve">
                                <CheckCircle2 className="h-4 w-4" />
                              </button>
                              <button onClick={() => setRejectTarget({ id: f.id, reason: '' })} className="rounded-lg bg-red-500/10 p-2 text-red-400 hover:bg-red-500/20" title="Reject">
                                <XCircle className="h-4 w-4" />
                              </button>
                            </>
                          )}
                          <button onClick={() => setOfflineFundraiser(f)} className="rounded-lg bg-amber-500/10 p-2 text-amber-400 hover:bg-amber-500/20" title="Record offline donation">
                            <WifiOff className="h-4 w-4" />
                          </button>
                          <button onClick={() => setUpdateTarget(f)} className="rounded-lg bg-sky-500/10 p-2 text-sky-400 hover:bg-sky-500/20" title="Post campaign update">
                            <Plus className="h-4 w-4" />
                          </button>
                          <button onClick={() => startEdit(f)} className="rounded-lg bg-neon-blue/10 p-2 text-neon-blue hover:bg-neon-blue/20" title="Edit">
                            <Pencil className="h-4 w-4" />
                          </button>
                          <button onClick={() => deleteMutation.mutate(f.id)} disabled={deleteMutation.isPending} className="rounded-lg bg-red-500/10 p-2 text-red-400 hover:bg-red-500/20" title="Delete">
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </motion.tr>
                  ))}
                </tbody>
              </table>
              {!items.length && <div className="mt-8 text-center text-slate-500">No campaigns{tab === 'pending' ? ' pending approval' : ''}.</div>}
            </div>
          )}
        </div>
      </div>

      {/* Reject modal */}
      {rejectTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="glass-card w-full max-w-md p-6">
            <h3 className="mb-4 text-lg font-bold">Reject Campaign</h3>
            <label className="mb-1 block text-sm">Reason (optional)</label>
            <textarea
              rows={3}
              value={rejectTarget.reason}
              onChange={(e) => setRejectTarget((prev) => prev ? { ...prev, reason: e.target.value } : null)}
              className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm outline-none focus:border-neon-blue"
            />
            <div className="mt-4 flex gap-3">
              <button onClick={() => setRejectTarget(null)} className="btn-secondary flex-1">Cancel</button>
              <button
                onClick={() => rejectMutation.mutate({ id: rejectTarget.id, reason: rejectTarget.reason || undefined })}
                disabled={rejectMutation.isPending}
                className="flex-1 rounded-xl bg-red-500 px-4 py-2 font-medium text-white hover:bg-red-600"
              >
                {rejectMutation.isPending ? <Loader2 className="mx-auto h-4 w-4 animate-spin" /> : 'Reject'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Offline donation modal */}
      {offlineFundraiser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="glass-card w-full max-w-md p-6">
            <h3 className="mb-1 text-lg font-bold">Record Offline Donation</h3>
            <p className="mb-4 text-sm text-slate-500 dark:text-slate-400">Campaign: {offlineFundraiser.title}</p>
            <form onSubmit={offlineForm.handleSubmit((dto) => offlineMutation.mutate({ id: offlineFundraiser.id, dto }))} className="space-y-4">
              <div>
                <label className="mb-1 block text-sm">Amount (£) *</label>
                <input type="number" step="0.01" min="0.01" {...offlineForm.register('amount')} className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm outline-none focus:border-neon-blue" />
              </div>
              <div>
                <label className="mb-1 block text-sm">Donor name (optional)</label>
                <input {...offlineForm.register('displayName')} className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm outline-none focus:border-neon-blue" />
              </div>
              <div>
                <label className="mb-1 block text-sm">Message (optional)</label>
                <textarea {...offlineForm.register('message')} rows={2} className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm outline-none focus:border-neon-blue" />
              </div>
              <div className="flex gap-3">
                <button type="button" onClick={() => { setOfflineFundraiser(null); offlineForm.reset(); }} className="btn-secondary flex-1">Cancel</button>
                <button type="submit" disabled={offlineMutation.isPending} className="btn-primary flex-1">
                  {offlineMutation.isPending ? <Loader2 className="mx-auto h-4 w-4 animate-spin" /> : 'Record'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Fundraiser update modal */}
      {updateTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="glass-card w-full max-w-2xl p-6">
            <h3 className="mb-1 text-lg font-bold">Post Campaign Update</h3>
            <p className="mb-4 text-sm text-slate-500 dark:text-slate-400">Campaign: {updateTarget.title}</p>

            <form
              onSubmit={updateForm.handleSubmit((dto) => addUpdateMutation.mutate({ id: updateTarget.id, dto }))}
              className="space-y-4"
            >
              <div>
                <label className="mb-1 block text-sm">Update title *</label>
                <input
                  {...updateForm.register('title')}
                  className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm outline-none focus:border-neon-blue"
                />
                {updateForm.formState.errors.title && (
                  <p className="mt-1 text-xs text-red-400">{updateForm.formState.errors.title.message}</p>
                )}
              </div>

              <div>
                <label className="mb-1 block text-sm">Update content *</label>
                <Controller
                  name="content"
                  control={updateForm.control}
                  render={({ field }) => (
                    <RichTextEditor
                      value={field.value}
                      onChange={field.onChange}
                      placeholder="Share campaign progress, milestones, or thank-you notes"
                      minHeightClassName="min-h-[180px]"
                    />
                  )}
                />
                {updateForm.formState.errors.content && (
                  <p className="mt-1 text-xs text-red-400">{updateForm.formState.errors.content.message}</p>
                )}
              </div>

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setUpdateTarget(null);
                    updateForm.reset();
                  }}
                  className="btn-secondary flex-1"
                >
                  Cancel
                </button>
                <button type="submit" disabled={addUpdateMutation.isPending} className="btn-primary flex-1">
                  {addUpdateMutation.isPending ? <Loader2 className="mx-auto h-4 w-4 animate-spin" /> : 'Post Update'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
