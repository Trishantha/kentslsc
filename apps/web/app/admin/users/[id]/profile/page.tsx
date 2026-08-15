'use client';

import { useState } from 'react';
import { useParams } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Loader2, User, Shield, Ban, CheckCircle, LogOut, AlertTriangle } from 'lucide-react';
import { api, getApiErrorMessage } from '@/lib/api';
import { formatDate } from '@/lib/utils';
import { useAuth } from '@/hooks/useAuth';
import { UserRole, UserStatus } from '@kentslsc/shared';
import type { UserDetail, StructuredAddress } from '../../types';

function formatAddress(address?: StructuredAddress | null) {
  if (!address) return '-';
  const parts = [address.buildingStreet, address.locality, address.townCity, address.postcode].filter(Boolean);
  return parts.join(', ');
}

const roleOptions = Object.values(UserRole).map((role) => ({ value: role, label: role }));

export default function UserProfilePage() {
  const { id } = useParams<{ id: string }>();
  const queryClient = useQueryClient();
  const { data: currentUser } = useAuth();
  const [error, setError] = useState<string | null>(null);

  const { data: detail, isLoading } = useQuery<UserDetail>({
    queryKey: ['admin', 'users', id],
    queryFn: async () => {
      const res = await api.get(`/admin/users/${id}`);
      return res.data;
    },
    enabled: !!id
  });

  const roleMutation = useMutation({
    mutationFn: async (role: UserRole) => {
      const res = await api.patch(`/admin/users/${id}/role`, { role });
      return res.data;
    },
    onSuccess: () => {
      setError(null);
      queryClient.invalidateQueries({ queryKey: ['admin', 'users'] });
      queryClient.invalidateQueries({ queryKey: ['admin', 'users', id] });
    },
    onError: (err) => setError(getApiErrorMessage(err))
  });

  const statusMutation = useMutation({
    mutationFn: async (status: UserStatus) => {
      const res = await api.patch(`/admin/users/${id}/status`, { status });
      return res.data;
    },
    onSuccess: () => {
      setError(null);
      queryClient.invalidateQueries({ queryKey: ['admin', 'users'] });
      queryClient.invalidateQueries({ queryKey: ['admin', 'users', id] });
    },
    onError: (err) => setError(getApiErrorMessage(err))
  });

  const logoutMutation = useMutation({
    mutationFn: async () => {
      const res = await api.post(`/admin/users/${id}/force-logout`);
      return res.data;
    },
    onSuccess: () => {
      setError(null);
      queryClient.invalidateQueries({ queryKey: ['admin', 'users', id] });
    },
    onError: (err) => setError(getApiErrorMessage(err))
  });

  const isAdmin = currentUser?.role === UserRole.ADMIN;
  const isSelf = currentUser?.id === id;
  const isBanned = detail?.status === UserStatus.BANNED;

  if (isLoading || !detail) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-neon-blue" />
      </div>
    );
  }

  return (
    <div className="max-w-3xl space-y-6">
      <section className="glass-card p-5">
        <h3 className="mb-4 flex items-center gap-2 text-lg font-semibold">
          <User className="h-5 w-5 text-neon-blue" /> Personal Information
        </h3>
        <dl className="grid gap-3 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-slate-500">First Name</dt>
            <dd className="font-medium">{detail.firstName || '-'}</dd>
          </div>
          <div>
            <dt className="text-slate-500">Last Name</dt>
            <dd className="font-medium">{detail.lastName || '-'}</dd>
          </div>
          <div>
            <dt className="text-slate-500">Email</dt>
            <dd className="font-medium">{detail.email}</dd>
          </div>
          <div>
            <dt className="text-slate-500">Phone</dt>
            <dd className="font-medium">{detail.phone || '-'}</dd>
          </div>
          <div className="sm:col-span-2">
            <dt className="text-slate-500">Address</dt>
            <dd className="font-medium">{formatAddress(detail.address)}</dd>
          </div>
          <div>
            <dt className="text-slate-500">Role</dt>
            <dd className="font-medium">
              <span className="rounded-full bg-neon-gold/10 px-2 py-1 text-xs font-semibold text-neon-gold">
                {detail.role}
              </span>
            </dd>
          </div>
          <div>
            <dt className="text-slate-500">Status</dt>
            <dd className="font-medium">
              <span
                className={`rounded-full px-2 py-1 text-xs font-semibold ${
                  isBanned ? 'bg-red-500/10 text-red-400' : 'bg-green-500/10 text-green-400'
                }`}
              >
                {isBanned ? 'BANNED' : 'ACTIVE'}
              </span>
            </dd>
          </div>
          <div>
            <dt className="text-slate-500">Joined</dt>
            <dd className="font-medium">{formatDate(detail.createdAt)}</dd>
          </div>
        </dl>
      </section>

      {isAdmin && !isSelf && (
        <section className="glass-card p-5">
          <h3 className="mb-4 flex items-center gap-2 text-lg font-semibold">
            <Shield className="h-5 w-5 text-neon-blue" /> Account Management
          </h3>

          <div className="space-y-5">
            <div>
              <label className="mb-2 block text-sm font-medium text-slate-300">Platform Role</label>
              <select
                value={detail.role}
                onChange={(e) => roleMutation.mutate(e.target.value as UserRole)}
                disabled={roleMutation.isPending}
                className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-slate-100 outline-none focus:border-neon-blue disabled:opacity-60"
              >
                {roleOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
              <p className="mt-1 text-xs text-slate-500">
                Changing the role revokes all existing sessions for this user.
              </p>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <button
                type="button"
                onClick={() =>
                  statusMutation.mutate(isBanned ? UserStatus.ACTIVE : UserStatus.BANNED)
                }
                disabled={statusMutation.isPending}
                className={`inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition-transform hover:scale-[1.02] disabled:opacity-60 ${
                  isBanned
                    ? 'bg-green-500/10 text-green-400 hover:bg-green-500/20'
                    : 'bg-red-500/10 text-red-400 hover:bg-red-500/20'
                }`}
              >
                {statusMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : isBanned ? (
                  <CheckCircle className="h-4 w-4" />
                ) : (
                  <Ban className="h-4 w-4" />
                )}
                {isBanned ? 'Unban Account' : 'Ban Account'}
              </button>

              <button
                type="button"
                onClick={() => logoutMutation.mutate()}
                disabled={logoutMutation.isPending}
                className="inline-flex items-center gap-2 rounded-xl bg-slate-500/10 px-4 py-2.5 text-sm font-semibold text-slate-300 transition-transform hover:scale-[1.02] hover:bg-slate-500/20 disabled:opacity-60"
              >
                {logoutMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <LogOut className="h-4 w-4" />
                )}
                Force Logout
              </button>
            </div>

            {isBanned && (
              <div className="flex items-start gap-2 rounded-xl bg-red-500/10 p-3 text-sm text-red-400">
                <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0" />
                <span>This account is banned and cannot log in or use any authenticated features.</span>
              </div>
            )}
          </div>

          {error && (
            <div className="mt-4 rounded-xl bg-red-500/10 p-3 text-sm text-red-400">
              {error}
            </div>
          )}
        </section>
      )}
    </div>
  );
}
