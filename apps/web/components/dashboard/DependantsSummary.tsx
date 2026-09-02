'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { Users, Plus, Trash2, Save, Loader2, ArrowRight } from 'lucide-react';
import { api, getApiErrorMessage } from '@/lib/api';
import { useMyMembership } from './useMyMembership';

export function DependantsSummary() {
  const queryClient = useQueryClient();
  const { data: membership, isLoading } = useMyMembership();
  const [isAdding, setIsAdding] = useState(false);
  const [newDependant, setNewDependant] = useState({ name: '', age: 0, relationship: 'child' });
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const updateDependants = useMutation({
    mutationFn: async (dependants: { name: string; age: number; relationship: string }[]) => {
      const res = await api.patch('/membership/me/dependants', { dependants });
      return res.data;
    },
    onSuccess: () => {
      setError(null);
      setSaved(true);
      setIsAdding(false);
      setNewDependant({ name: '', age: 0, relationship: 'child' });
      setTimeout(() => setSaved(false), 3000);
      void queryClient.invalidateQueries({ queryKey: ['my-membership'] });
    },
    onError: (err) => {
      setError(getApiErrorMessage(err));
      setSaved(false);
    }
  });

  if (isLoading) {
    return (
      <div className="glass-card flex items-center justify-center p-8">
        <Loader2 className="h-6 w-6 animate-spin text-neon-blue" />
      </div>
    );
  }

  if (!membership) {
    return null;
  }

  const dependants = membership.dependants ?? [];

  const handleAdd = () => {
    if (!newDependant.name.trim()) return;
    updateDependants.mutate([...dependants, newDependant]);
  };

  const handleRemove = (idx: number) => {
    const next = dependants.filter((_, i) => i !== idx);
    updateDependants.mutate(next);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.25 }}
      className="glass-card p-6"
    >
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Users className="h-6 w-6 text-neon-blue" />
          <h2 className="text-xl font-bold">Dependants</h2>
        </div>
        <Link
          href="/dashboard/dependants"
          className="inline-flex items-center text-sm font-medium text-neon-blue hover:underline"
        >
          Manage <ArrowRight className="ml-1 h-4 w-4" />
        </Link>
      </div>

      {dependants.length === 0 && !isAdding && (
        <p className="mt-4 text-sm text-slate-600 dark:text-slate-400">
          You have not added any dependants yet.
        </p>
      )}

      {dependants.length > 0 && (
        <ul className="mt-4 space-y-2">
          {dependants.map((dep, idx) => (
            <li
              key={idx}
              className="flex items-center justify-between gap-3 rounded-xl border border-slate-300 bg-slate-200/50 px-4 py-2 text-sm dark:border-white/10 dark:bg-white/5"
            >
              <div className="flex items-center gap-3">
                <span className="rounded-full bg-neon-blue/10 px-2 py-0.5 text-xs font-semibold text-neon-blue capitalize">
                  {dep.relationship}
                </span>
                <span className="font-medium">{dep.name}</span>
                <span className="text-xs text-slate-500">Age {dep.age}</span>
              </div>
              <button
                type="button"
                onClick={() => handleRemove(idx)}
                disabled={updateDependants.isPending}
                className="text-red-500 hover:text-red-400 disabled:opacity-50"
                title="Remove dependant"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </li>
          ))}
        </ul>
      )}

      {isAdding ? (
            <div className="mt-4 rounded-xl border border-slate-300 bg-slate-200/50 p-4 dark:border-white/10 dark:bg-white/5">
              <div className="grid gap-3 sm:grid-cols-3">
                <div>
                  <label className="block text-xs text-slate-500">Name</label>
                  <input
                    type="text"
                    value={newDependant.name}
                    onChange={(e) => setNewDependant((prev) => ({ ...prev, name: e.target.value }))}
                    className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-neon-blue dark:border-white/10 dark:bg-white/5"
                    placeholder="Dependant name"
                  />
                </div>
                <div>
                  <label className="block text-xs text-slate-500">Age</label>
                  <input
                    type="number"
                    min={0}
                    max={120}
                    value={newDependant.age}
                    onChange={(e) => setNewDependant((prev) => ({ ...prev, age: Number(e.target.value) || 0 }))}
                    className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-neon-blue dark:border-white/10 dark:bg-white/5"
                  />
                </div>
                <div>
                  <label className="block text-xs text-slate-500">Relationship</label>
                  <select
                    value={newDependant.relationship}
                    onChange={(e) =>
                      setNewDependant((prev) => ({ ...prev, relationship: e.target.value }))
                    }
                    className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-neon-blue dark:border-white/10 dark:bg-white/5"
                  >
                    <option value="spouse">Spouse</option>
                    <option value="child">Child</option>
                  </select>
                </div>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={handleAdd}
                  disabled={updateDependants.isPending || !newDependant.name.trim()}
                  className="inline-flex items-center gap-2 rounded-lg bg-neon-blue/10 px-3 py-2 text-sm font-semibold text-neon-blue hover:bg-neon-blue/20 disabled:opacity-50"
                >
                  {updateDependants.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Save className="h-4 w-4" />
                  )}
                  Save
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setIsAdding(false);
                    setNewDependant({ name: '', age: 0, relationship: 'child' });
                    setError(null);
                  }}
                  className="inline-flex items-center gap-2 rounded-lg bg-white/5 px-3 py-2 text-sm font-medium text-slate-300 hover:bg-white/10"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setIsAdding(true)}
              className="mt-4 inline-flex items-center gap-2 rounded-xl bg-neon-blue/10 px-4 py-2 text-sm font-semibold text-neon-blue transition-colors hover:bg-neon-blue/20"
            >
              <Plus className="h-4 w-4" /> Add dependant
            </button>
          )}

          {saved && <p className="mt-3 text-sm text-green-400">Dependants saved.</p>}
          {error && <p className="mt-3 text-sm text-red-400">{error}</p>}
    </motion.div>
  );
}
