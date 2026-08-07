'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import { Loader2, Plus, Pencil, Trash2, X, Check } from 'lucide-react';
import { api } from '@/lib/api';
import { MembershipFeature, membershipFeatureLabels } from '@kentslsc/shared';

interface MembershipType {
  id: string;
  name: string;
  description?: string | null;
  price: number;
  isFree: boolean;
  durationMonths: number;
  benefits: string[];
  features: MembershipFeature[];
  autoActivate: boolean;
}

interface FeatureDef {
  value: MembershipFeature;
  label: string;
  description: string;
}

const emptyForm = {
  name: '',
  description: '',
  price: '',
  isFree: false,
  durationMonths: '12',
  benefits: '',
  features: [] as MembershipFeature[],
  autoActivate: false
};

export default function AdminMembershipTypesPage() {
  const queryClient = useQueryClient();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [isOpen, setIsOpen] = useState(false);

  const { data: types = [], isLoading: typesLoading } = useQuery<MembershipType[]>({
    queryKey: ['membership-types'],
    queryFn: async () => {
      const res = await api.get('/membership/types');
      return res.data;
    }
  });

  const { data: featureDefinitions = [] } = useQuery<FeatureDef[]>({
    queryKey: ['membership-features'],
    queryFn: async () => {
      const res = await api.get('/membership/features');
      return res.data;
    }
  });

  const saveMutation = useMutation({
    mutationFn: async (payload: Partial<MembershipType>) => {
      if (editingId) {
        const res = await api.patch(`/membership/types/${editingId}`, payload);
        return res.data;
      }
      const res = await api.post('/membership/types', payload);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['membership-types'] });
      closeForm();
    }
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await api.delete(`/membership/types/${id}`);
      return res.data;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['membership-types'] })
  });

  const openCreate = () => {
    setEditingId(null);
    setForm(emptyForm);
    setIsOpen(true);
  };

  const openEdit = (type: MembershipType) => {
    setEditingId(type.id);
    setForm({
      name: type.name,
      description: type.description ?? '',
      price: String(type.price),
      isFree: type.isFree,
      durationMonths: String(type.durationMonths),
      benefits: type.benefits.join('\n'),
      features: type.features,
      autoActivate: type.autoActivate
    });
    setIsOpen(true);
  };

  const closeForm = () => {
    setIsOpen(false);
    setEditingId(null);
    setForm(emptyForm);
    saveMutation.reset();
  };

  const toggleFeature = (feature: MembershipFeature) => {
    setForm((prev) => ({
      ...prev,
      features: prev.features.includes(feature) ? prev.features.filter((f) => f !== feature) : [...prev.features, feature]
    }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const payload = {
      name: form.name,
      description: form.description || undefined,
      price: Number(form.price),
      isFree: form.isFree,
      durationMonths: Number(form.durationMonths),
      benefits: form.benefits.split('\n').map((b) => b.trim()).filter(Boolean),
      features: form.features,
      autoActivate: form.autoActivate
    };
    saveMutation.mutate(payload);
  };

  return (
    <div>
      <div className="flex items-center justify-between">
        <h1 className="section-title">Membership Types</h1>
        <button onClick={openCreate} className="btn-primary inline-flex text-sm">
          <Plus className="mr-2 h-4 w-4" /> Add Type
        </button>
      </div>

      <div className="mt-6 glass-card p-6">
        {typesLoading ? (
          <div className="flex h-40 items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-neon-blue" />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-white/10 text-slate-500 dark:text-slate-400">
                  <th className="py-3 font-medium">Name</th>
                  <th className="py-3 font-medium">Price</th>
                  <th className="py-3 font-medium">Duration</th>
                  <th className="py-3 font-medium">Features</th>
                  <th className="py-3 font-medium">Auto-activate</th>
                  <th className="py-3 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {types.map((type, idx) => (
                  <motion.tr key={type.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: idx * 0.03 }}>
                    <td className="py-3">
                      <div className="font-medium">{type.name}</div>
                      <div className="text-xs text-slate-500">{type.description}</div>
                    </td>
                    <td className="py-3">{type.isFree || type.price === 0 ? 'Free' : `£${type.price}`}</td>
                    <td className="py-3">
                      {type.isFree ? 'Lifetime' : `${type.durationMonths} months`}
                    </td>
                    <td className="py-3">
                      <div className="flex max-w-xs flex-wrap gap-1">
                        {type.features.map((feature) => (
                          <span key={feature} className="rounded-full bg-neon-blue/10 px-2 py-0.5 text-xs text-neon-blue">
                            {membershipFeatureLabels[feature]?.label ?? feature}
                          </span>
                        ))}
                        {type.features.length === 0 && <span className="text-slate-500">None</span>}
                      </div>
                    </td>
                    <td className="py-3">
                      {type.autoActivate ? (
                        <span className="inline-flex items-center gap-1 text-xs text-green-400"><Check className="h-3 w-3" /> Yes</span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-xs text-slate-500"><X className="h-3 w-3" /> No</span>
                      )}
                    </td>
                    <td className="py-3">
                      <div className="flex gap-2">
                        <button onClick={() => openEdit(type)} className="rounded-lg bg-neon-blue/10 p-2 text-neon-blue hover:bg-neon-blue/20">
                          <Pencil className="h-3 w-3" />
                        </button>
                        <button onClick={() => deleteMutation.mutate(type.id)} className="rounded-lg bg-red-500/10 p-2 text-red-400 hover:bg-red-500/20">
                          <Trash2 className="h-3 w-3" />
                        </button>
                      </div>
                    </td>
                  </motion.tr>
                ))}
              </tbody>
            </table>
            {!types.length && <div className="mt-8 text-center text-slate-500">No membership types found.</div>}
          </div>
        )}
      </div>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
          >
            <motion.div
              initial={{ scale: 0.95 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.95 }}
              className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-white/10 bg-slate-900 p-6 shadow-xl"
            >
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold">{editingId ? 'Edit Membership Type' : 'New Membership Type'}</h2>
                <button onClick={closeForm} className="rounded-lg p-2 text-slate-400 hover:bg-white/10">
                  <X className="h-4 w-4" />
                </button>
              </div>

              <form onSubmit={handleSubmit} className="mt-6 space-y-4">
                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <label className="text-sm font-medium">Name</label>
                    <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="mt-1 w-full rounded-lg border border-white/10 bg-white/5 px-4 py-2 outline-none" required />
                  </div>
                  <div>
                    <label className="text-sm font-medium">Duration (months)</label>
                    <input type="number" value={form.durationMonths} onChange={(e) => setForm({ ...form, durationMonths: e.target.value })} className="mt-1 w-full rounded-lg border border-white/10 bg-white/5 px-4 py-2 outline-none" required min={1} />
                  </div>
                </div>

                <div>
                  <label className="text-sm font-medium">Description</label>
                  <input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className="mt-1 w-full rounded-lg border border-white/10 bg-white/5 px-4 py-2 outline-none" />
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <label className="text-sm font-medium">Price (£)</label>
                    <input type="number" step="0.01" min="0" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} className="mt-1 w-full rounded-lg border border-white/10 bg-white/5 px-4 py-2 outline-none" required />
                  </div>
                  <div className="flex items-center gap-4 pt-6">
                    <label className="flex items-center gap-2">
                      <input type="checkbox" checked={form.isFree} onChange={(e) => setForm({ ...form, isFree: e.target.checked, price: e.target.checked ? '0' : form.price })} className="h-4 w-4 rounded border-white/10 bg-white/5 text-neon-blue" />
                      <span className="text-sm">Free</span>
                    </label>
                    <label className="flex items-center gap-2">
                      <input type="checkbox" checked={form.autoActivate} onChange={(e) => setForm({ ...form, autoActivate: e.target.checked })} className="h-4 w-4 rounded border-white/10 bg-white/5 text-neon-blue" />
                      <span className="text-sm">Auto-activate</span>
                    </label>
                  </div>
                </div>

                <div>
                  <label className="text-sm font-medium">Benefits (one per line)</label>
                  <textarea value={form.benefits} onChange={(e) => setForm({ ...form, benefits: e.target.value })} rows={3} className="mt-1 w-full rounded-lg border border-white/10 bg-white/5 px-4 py-2 outline-none" />
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium">Features</label>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {featureDefinitions.map((feature) => {
                      const checked = form.features.includes(feature.value);
                      return (
                        <button
                          key={feature.value}
                          type="button"
                          onClick={() => toggleFeature(feature.value)}
                          className={`flex items-start gap-3 rounded-xl border p-3 text-left transition-colors ${
                            checked ? 'border-neon-blue bg-neon-blue/10' : 'border-white/10 bg-white/5'
                          }`}
                        >
                          <div className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded border ${checked ? 'border-neon-blue bg-neon-blue' : 'border-white/20'}`}>
                            {checked && <Check className="h-3 w-3 text-slate-950" />}
                          </div>
                          <div>
                            <div className="text-sm font-medium">{feature.label}</div>
                            <div className="text-xs text-slate-500">{feature.description}</div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {saveMutation.isError && (
                  <p className="text-sm text-red-500">Failed to save. Please check your inputs.</p>
                )}

                <div className="flex justify-end gap-3 pt-4">
                  <button type="button" onClick={closeForm} className="rounded-xl px-4 py-2 text-sm font-medium text-slate-400 hover:bg-white/5">
                    Cancel
                  </button>
                  <button type="submit" disabled={saveMutation.isPending} className="btn-primary inline-flex text-sm">
                    {saveMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                    {editingId ? 'Update' : 'Create'}
                  </button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
