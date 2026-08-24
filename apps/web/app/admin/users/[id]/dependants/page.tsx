'use client';

import { useParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { Loader2, Users, User } from 'lucide-react';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';
import type { UserDetail } from '../../types';

export default function UserDependantsPage() {
  const { id } = useParams<{ id: string }>();

  const { data: detail, isLoading } = useQuery<UserDetail>({
    queryKey: ['admin', 'users', id],
    queryFn: async () => {
      const res = await api.get(`/admin/users/${id}`);
      return res.data;
    },
    enabled: !!id
  });

  if (isLoading || !detail) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-neon-blue" />
      </div>
    );
  }

  const dependants = detail.dependants ?? [];

  return (
    <div className="max-w-3xl">
      <section className="glass-card p-5">
        <h3 className="mb-4 flex items-center gap-2 text-lg font-semibold">
          <Users className="h-5 w-5 text-neon-blue" /> Dependants
        </h3>
        {dependants.length === 0 ? (
          <p className="text-sm text-slate-500">No dependants found.</p>
        ) : (
          <div className="space-y-3">
            {dependants.map((dependant, idx) => (
              <div
                key={`${dependant.membershipId}-${dependant.name}-${idx}`}
                className="flex flex-col gap-3 rounded-xl border border-white/10 bg-white/5 p-4 text-sm sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="flex items-start gap-3">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-neon-blue/10 text-neon-blue">
                    <User className="h-4 w-4" />
                  </div>
                  <div>
                    <p className="font-semibold">{dependant.name}</p>
                    <p className="text-slate-500">
                      Age {dependant.age}
                      <span className="mx-2">·</span>
                      {dependant.membershipTypeName}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
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
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
