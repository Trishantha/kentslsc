'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Loader2, Users, Plus, Trash2, Save } from 'lucide-react';
import { api, getApiErrorMessage } from '@/lib/api';
import { cn } from '@/lib/utils';
import type { UserDetail, DependantItem } from '../../types';

export default function UserDependantsPage() {
  const { id } = useParams<{ id: string }>();
  const queryClient = useQueryClient();

  const { data: detail, isLoading } = useQuery<UserDetail>({
    queryKey: ['admin', 'users', id],
    queryFn: async () => {
      const res = await api.get(`/admin/users/${id}`);
      return res.data;
    },
    enabled: !!id
  });

  const [dependants, setDependants] = useState<DependantItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    setDependants(detail?.dependants ?? []);
  }, [detail?.dependants]);

  const saveMutation = useMutation({
    mutationFn: async (payload: DependantItem[]) => {
      const res = await api.put(`/admin/users/${id}/dependants`, {
        dependants: payload.map((d) => ({
          name: d.name,
          age: d.age,
          relationship: d.relationship
        }))
      });
      return res.data;
    },
    onSuccess: () => {
      setError(null);
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
      void queryClient.invalidateQueries({ queryKey: ['admin', 'users', id] });
    },
    onError: (err) => {
      setError(getApiErrorMessage(err));
      setSaved(false);
    }
  });

  if (isLoading || !detail) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-neon-blue" />
      </div>
    );
  }

  const handleRemove = (idx: number) => {
    setDependants((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleAdd = (relationship: 'spouse' | 'child') => {
    setDependants((prev) => [
      ...prev,
      {
        name: '',
        age: 0,
        relationship,
        membershipId: detail.memberships[0]?.id ?? '',
        membershipTypeName: detail.memberships[0]?.membershipType.name ?? '',
        membershipStatus: detail.memberships[0]?.status ?? ''
      }
    ]);
  };

  const handleUpdate = (idx: number, patch: Partial<DependantItem>) => {
    setDependants((prev) => prev.map((d, i) => (i === idx ? { ...d, ...patch } : d)));
  };

  const hasSpouse = dependants.some((d) => d.relationship === 'spouse');

  return (
    <div className="max-w-3xl space-y-4">
      <section className="glass-card p-5">
        <h3 className="mb-4 flex items-center gap-2 text-lg font-semibold">
          <Users className="h-5 w-5 text-neon-blue" /> Dependants
        </h3>

        {dependants.length === 0 && (
          <p className="mb-4 text-sm text-slate-500">No dependants found.</p>
        )}

        {dependants.length > 0 && (
          <div className="space-y-3">
            {dependants.map((dependant, idx) => (
              <div
                key={`${dependant.membershipId}-${dependant.name}-${idx}`}
                className="rounded-xl border border-white/10 bg-white/5 p-4"
              >
                <div className="mb-3 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 text-sm">
                    <span
                      className={cn(
                        'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold capitalize',
                        dependant.relationship === 'spouse'
                          ? 'bg-purple-500/10 text-purple-400'
                          : 'bg-blue-500/10 text-blue-400'
                      )}
                    >
                      {dependant.relationship}
                    </span>
                    <span
                      className={cn(
                        'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold uppercase',
                        dependant.membershipStatus === 'ACTIVE'
                          ? 'bg-green-500/10 text-green-400'
                          : dependant.membershipStatus === 'EXPIRED'
                          ? 'bg-amber-500/10 text-amber-400'
                          : 'bg-slate-500/10 text-slate-400'
                      )}
                    >
                      {dependant.membershipStatus}
                    </span>
                    <span className="text-xs text-slate-500">{dependant.membershipTypeName}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleRemove(idx)}
                    className="text-red-400 hover:text-red-300"
                    title="Remove dependant"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
                <div className="grid gap-3 sm:grid-cols-3">
                  <div>
                    <label className="mb-1 block text-xs text-slate-500">Name</label>
                    <input
                      type="text"
                      value={dependant.name}
                      onChange={(e) => handleUpdate(idx, { name: e.target.value })}
                      className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-slate-100 outline-none focus:border-neon-blue"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs text-slate-500">Age</label>
                    <input
                      type="number"
                      min={0}
                      max={120}
                      value={dependant.age}
                      onChange={(e) => handleUpdate(idx, { age: Number(e.target.value) || 0 })}
                      className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-slate-100 outline-none focus:border-neon-blue"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs text-slate-500">Relationship</label>
                    <select
                      value={dependant.relationship}
                      onChange={(e) =>
                        handleUpdate(idx, { relationship: e.target.value as 'spouse' | 'child' })
                      }
                      className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-slate-100 outline-none focus:border-neon-blue"
                    >
                      <option value="spouse">Spouse</option>
                      <option value="child">Child</option>
                    </select>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="mt-4 flex flex-wrap gap-3">
          {!hasSpouse && (
            <button
              type="button"
              onClick={() => handleAdd('spouse')}
              className="inline-flex items-center gap-2 rounded-xl bg-neon-gold/10 px-4 py-2 text-sm font-semibold text-neon-gold transition-colors hover:bg-neon-gold/20"
            >
              <Plus className="h-4 w-4" /> Add spouse
            </button>
          )}
          <button
            type="button"
            onClick={() => handleAdd('child')}
            className="inline-flex items-center gap-2 rounded-xl bg-neon-blue/10 px-4 py-2 text-sm font-semibold text-neon-blue transition-colors hover:bg-neon-blue/20"
          >
            <Plus className="h-4 w-4" /> Add child
          </button>
        </div>

        <button
          type="button"
          onClick={() => saveMutation.mutate(dependants)}
          disabled={saveMutation.isPending || dependants.some((d) => !d.name.trim())}
          className="btn-primary mt-4 inline-flex items-center gap-2 disabled:opacity-50"
        >
          {saveMutation.isPending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Save className="h-4 w-4" />
          )}
          Save dependants
        </button>

        {saved && <p className="mt-3 text-sm text-green-400">Dependants saved successfully.</p>}
        {error && <p className="mt-3 text-sm text-red-400">{error}</p>}
      </section>
    </div>
  );
}
