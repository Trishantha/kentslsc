'use client';

import { useEffect, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { Plus, Trash2, Save, Loader2 } from 'lucide-react';
import { MembershipFeature } from '@kentslsc/shared';
import { api, getApiErrorMessage } from '@/lib/api';
import { useMyMembership } from './useMyMembership';
import { UpgradePrompt } from './UpgradePrompt';
import { BecomeMemberCTA } from './BecomeMemberCTA';

export function DependantsEditor() {
  const queryClient = useQueryClient();
  const { data: membership, isLoading } = useMyMembership();
  const [editedDependants, setEditedDependants] = useState(membership?.dependants ?? []);
  const [dependantsError, setDependantsError] = useState<string | null>(null);
  const [dependantsSaved, setDependantsSaved] = useState(false);

  useEffect(() => {
    if (membership) {
      setEditedDependants(membership.dependants ?? []);
    }
  }, [membership]);

  const updateDependants = useMutation({
    mutationFn: async () => {
      const res = await api.patch('/membership/me/dependants', { dependants: editedDependants });
      return res.data;
    },
    onSuccess: () => {
      setDependantsError(null);
      setDependantsSaved(true);
      setTimeout(() => setDependantsSaved(false), 3000);
      queryClient.invalidateQueries({ queryKey: ['my-membership'] });
    },
    onError: (err) => {
      setDependantsSaved(false);
      setDependantsError(getApiErrorMessage(err));
    }
  });

  if (isLoading) {
    return (
      <div className="glass-card flex items-center justify-center p-12">
        <Loader2 className="h-8 w-8 animate-spin text-neon-blue" />
      </div>
    );
  }

  if (!membership) {
    return <BecomeMemberCTA />;
  }

  const supportsDependants = membership.membershipType.features?.includes(MembershipFeature.DEPENDANTS) ?? false;

  if (!supportsDependants) {
    return (
      <div className="space-y-6">
        <div className="glass-card p-6">
          <h2 className="text-lg font-bold">Dependants</h2>
          <p className="mt-2 text-slate-600 dark:text-slate-400">
            Your current membership does not include dependants.
          </p>
        </div>
        <UpgradePrompt membership={membership} />
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="glass-card p-6"
    >
      <h2 className="text-lg font-bold">Dependants</h2>

      {editedDependants.length === 0 && (
        <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
          You have not added any dependants yet.
        </p>
      )}

      <ul className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {editedDependants.map((dep, idx) => (
          <li
            key={idx}
            className="rounded-xl border border-slate-300 bg-slate-200/50 p-4 text-sm dark:border-white/10 dark:bg-white/5"
          >
            <div className="mb-2 flex items-center justify-between">
              <span className="rounded-full bg-neon-blue/10 px-2 py-0.5 text-xs font-semibold text-neon-blue capitalize">
                {dep.relationship}
              </span>
              <button
                type="button"
                onClick={() => setEditedDependants((prev) => prev.filter((_, i) => i !== idx))}
                className="text-red-500 hover:text-red-400"
                title="Remove dependant"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
            <div className="space-y-2">
              <div>
                <label className="block text-xs text-slate-500">Name</label>
                <input
                  type="text"
                  value={dep.name}
                  onChange={(e) =>
                    setEditedDependants((prev) =>
                      prev.map((d, i) => (i === idx ? { ...d, name: e.target.value } : d))
                    )
                  }
                  className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-neon-blue dark:border-white/10 dark:bg-white/5"
                />
              </div>
              <div>
                <label className="block text-xs text-slate-500">Age</label>
                <input
                  type="number"
                  min={0}
                  max={120}
                  value={dep.age}
                  onChange={(e) =>
                    setEditedDependants((prev) =>
                      prev.map((d, i) =>
                        i === idx ? { ...d, age: Number(e.target.value) || 0 } : d
                      )
                    )
                  }
                  className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-neon-blue dark:border-white/10 dark:bg-white/5"
                />
              </div>
              <div>
                <label className="block text-xs text-slate-500">Relationship</label>
                <select
                  value={dep.relationship}
                  onChange={(e) =>
                    setEditedDependants((prev) =>
                      prev.map((d, i) =>
                        i === idx
                          ? { ...d, relationship: e.target.value as 'spouse' | 'child' }
                          : d
                      )
                    )
                  }
                  className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-neon-blue dark:border-white/10 dark:bg-white/5"
                >
                  <option value="spouse">Spouse</option>
                  <option value="child">Child</option>
                </select>
              </div>
            </div>
          </li>
        ))}
      </ul>

      <div className="mt-4 flex flex-wrap gap-3">
        {!editedDependants.some((d) => d.relationship === 'spouse') && (
          <button
            type="button"
            onClick={() =>
              setEditedDependants((prev) => [...prev, { name: '', age: 0, relationship: 'spouse' }])
            }
            className="inline-flex items-center gap-2 rounded-xl bg-neon-gold/10 px-4 py-2 text-sm font-semibold text-neon-gold transition-colors hover:bg-neon-gold/20"
          >
            <Plus className="h-4 w-4" /> Add spouse
          </button>
        )}
        <button
          type="button"
          onClick={() =>
            setEditedDependants((prev) => [...prev, { name: '', age: 0, relationship: 'child' }])
          }
          className="inline-flex items-center gap-2 rounded-xl bg-neon-blue/10 px-4 py-2 text-sm font-semibold text-neon-blue transition-colors hover:bg-neon-blue/20"
        >
          <Plus className="h-4 w-4" /> Add child
        </button>
      </div>

      <button
        type="button"
        onClick={() => updateDependants.mutate()}
        disabled={updateDependants.isPending}
        className="btn-primary mt-4 inline-flex items-center gap-2 disabled:opacity-50"
      >
        {updateDependants.isPending ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Save className="h-4 w-4" />
        )}
        Save dependants
      </button>

      {dependantsSaved && <p className="mt-3 text-sm text-green-400">Dependants saved successfully.</p>}
      {dependantsError && <p className="mt-3 text-sm text-red-400">{dependantsError}</p>}
    </motion.div>
  );
}
