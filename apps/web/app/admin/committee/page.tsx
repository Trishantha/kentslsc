'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { motion, AnimatePresence } from 'framer-motion';
import { Loader2, Pencil, Plus, Trash2, X, Users, Globe, Save } from 'lucide-react';
import { api, getApiErrorMessage } from '@/lib/api';
import { ImageUpload } from '@/components/ui/ImageUpload';
import { revalidateCommitteePages } from './actions';

const committeeSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  position: z.string().min(1, 'Position is required'),
  roleKey: z.string().min(1, 'Role key is required'),
  photoUrl: z.string().url('Enter a valid image URL').optional().or(z.literal('')),
  displayOrder: z.coerce.number().int().min(0, 'Display order must be 0 or greater').default(0)
});

type CommitteeForm = z.infer<typeof committeeSchema>;

interface CommitteeMember {
  id: string;
  name: string;
  position: string;
  roleKey: string;
  photoUrl: string | null;
  displayOrder: number;
}

export default function AdminCommitteePage() {
  const [editing, setEditing] = useState<CommitteeMember | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [saveStatus, setSaveStatus] = useState<{ type: 'success' | 'error'; message: string } | null>(
    null
  );
  const [isPublishing, setIsPublishing] = useState(false);
  const queryClient = useQueryClient();

  const showStatus = (type: 'success' | 'error', message: string) => {
    setSaveStatus({ type, message });
    if (type === 'success') {
      setTimeout(() => setSaveStatus(null), 4000);
    }
  };

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors, isDirty }
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

  const { data, isLoading } = useQuery<CommitteeMember[]>({
    queryKey: ['admin', 'committee'],
    queryFn: async () => {
      const res = await api.get('/committee');
      return res.data;
    }
  });

  const publishToWebsite = async () => {
    setIsPublishing(true);
    setSubmitError(null);
    try {
      await revalidateCommitteePages();
      showStatus('success', 'Website updated. Changes are now live on the about page.');
    } catch (err) {
      showStatus('error', `Could not update website: ${getApiErrorMessage(err)}`);
    } finally {
      setIsPublishing(false);
    }
  };

  const createMutation = useMutation({
    mutationFn: async (values: CommitteeForm) => {
      const res = await api.post('/committee', {
        ...values,
        photoUrl: values.photoUrl || undefined
      });
      return res.data;
    },
    onSuccess: async () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'committee'] });
      reset();
      setSubmitError(null);
      try {
        await revalidateCommitteePages();
        showStatus('success', 'Member saved and website updated.');
      } catch {
        showStatus('error', 'Member saved, but the website could not be refreshed automatically.');
      }
    },
    onError: (error) => {
      setSubmitError(getApiErrorMessage(error));
    }
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, values }: { id: string; values: CommitteeForm }) => {
      const res = await api.put(`/committee/${id}`, {
        ...values,
        photoUrl: values.photoUrl || ''
      });
      return res.data;
    },
    onSuccess: async () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'committee'] });
      setEditing(null);
      reset();
      setSubmitError(null);
      try {
        await revalidateCommitteePages();
        showStatus('success', 'Changes saved and website updated.');
      } catch {
        showStatus('error', 'Changes saved, but the website could not be refreshed automatically.');
      }
    },
    onError: (error) => {
      setSubmitError(getApiErrorMessage(error));
    }
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/committee/${id}`);
    },
    onSuccess: async () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'committee'] });
      try {
        await revalidateCommitteePages();
        showStatus('success', 'Member removed and website updated.');
      } catch {
        showStatus('error', 'Member removed, but the website could not be refreshed automatically.');
      }
    }
  });

  const onSubmit = (values: CommitteeForm) => {
    setSubmitError(null);
    setSaveStatus(null);
    if (editing) {
      updateMutation.mutate({ id: editing.id, values });
      return;
    }
    createMutation.mutate(values);
  };

  const startEdit = (member: CommitteeMember) => {
    setSubmitError(null);
    setSaveStatus(null);
    setEditing(member);
    reset({
      name: member.name,
      position: member.position,
      roleKey: member.roleKey,
      photoUrl: member.photoUrl ?? '',
      displayOrder: member.displayOrder
    });
  };

  const clearEdit = () => {
    setEditing(null);
    setSubmitError(null);
    setSaveStatus(null);
    reset({
      name: '',
      position: '',
      roleKey: '',
      photoUrl: '',
      displayOrder: 0
    });
  };

  return (
    <div>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="section-title">Committee</h1>
          <p className="mt-2 text-slate-600 dark:text-slate-400">
            Manage committee member name, position, role key, and photo.
          </p>
        </div>
        <button
          type="button"
          onClick={publishToWebsite}
          disabled={isPublishing}
          className="btn-primary flex w-full items-center justify-center gap-2 sm:w-auto"
        >
          {isPublishing ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Globe className="h-4 w-4" />
          )}
          {isPublishing ? 'Publishing…' : 'Publish to website'}
        </button>
      </div>

      <AnimatePresence>
        {saveStatus && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className={`mt-4 rounded-xl px-4 py-3 text-sm ${
              saveStatus.type === 'success'
                ? 'bg-green-500/10 text-green-400'
                : 'bg-red-500/10 text-red-400'
            }`}
          >
            {saveStatus.message}
          </motion.div>
        )}
      </AnimatePresence>

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <div className="glass-card p-6 lg:col-span-1">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-bold">{editing ? 'Edit Member' : 'Add Member'}</h2>
            {editing && (
              <button
                type="button"
                onClick={clearEdit}
                className="text-slate-500 hover:text-slate-300"
                aria-label="Cancel editing"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
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
              {errors.position && (
                <p className="mt-1 text-xs text-red-400">{errors.position.message}</p>
              )}
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
              {errors.roleKey && (
                <p className="mt-1 text-xs text-red-400">{errors.roleKey.message}</p>
              )}
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
              onChange={(url) => setValue('photoUrl', url, { shouldValidate: true, shouldDirty: true })}
              hideUrlInput
            />

            {submitError && <p className="text-sm text-red-400">{submitError}</p>}

            <button
              type="submit"
              disabled={createMutation.isPending || updateMutation.isPending || !isDirty}
              className="btn-primary w-full"
            >
              {createMutation.isPending || updateMutation.isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Save className="mr-2 h-4 w-4" />
              )}
              {createMutation.isPending || updateMutation.isPending
                ? 'Saving…'
                : editing
                  ? 'Save Changes'
                  : 'Save Member'}
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
                    <th className="py-3 font-medium">Member</th>
                    <th className="py-3 font-medium">Role key</th>
                    <th className="py-3 font-medium">Order</th>
                    <th className="py-3 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {data?.map((member, idx) => (
                    <motion.tr
                      key={member.id}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: idx * 0.03 }}
                    >
                      <td className="py-3">
                        <div className="flex items-center gap-3">
                          <div className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-full bg-white/10 text-slate-400">
                            {member.photoUrl ? (
                              <img
                                src={member.photoUrl}
                                alt={member.name}
                                className="h-full w-full object-cover"
                              />
                            ) : (
                              <Users className="h-4 w-4" />
                            )}
                          </div>
                          <div>
                            <div className="font-medium">{member.name}</div>
                            <div className="text-xs text-slate-500">{member.position}</div>
                          </div>
                        </div>
                      </td>
                      <td className="py-3 text-slate-600 dark:text-slate-400">{member.roleKey}</td>
                      <td className="py-3">{member.displayOrder}</td>
                      <td className="py-3">
                        <div className="flex gap-2">
                          <button
                            onClick={() => startEdit(member)}
                            className="rounded-lg bg-neon-blue/10 p-2 text-neon-blue hover:bg-neon-blue/20"
                            aria-label={`Edit ${member.name}`}
                          >
                            <Pencil className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => deleteMutation.mutate(member.id)}
                            className="rounded-lg bg-red-500/10 p-2 text-red-400 hover:bg-red-500/20"
                            aria-label={`Delete ${member.name}`}
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </motion.tr>
                  ))}
                </tbody>
              </table>

              {!data?.length && (
                <div className="mt-8 text-center text-slate-500">No committee members yet.</div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
