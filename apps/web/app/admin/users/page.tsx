'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { AnimatePresence, motion } from 'framer-motion';
import {
  Loader2,
  Search,
  User,
  Eye,
  Plus,
  Check,
  Mail,
  X
} from 'lucide-react';
import Link from 'next/link';
import { api, getApiErrorMessage } from '@/lib/api';
import { Permission, permissionLabels } from '@kentslsc/shared';
import { useAuth } from '@/hooks/useAuth';
import { cn } from '@/lib/utils';
import { AdminListLayout } from '@/components/admin/AdminListLayout';
import type { UserItem, UsersResponse, Role } from './types';

const platformRoles = ['ALL', 'ADMIN', 'MEMBER', 'BUSINESS_OWNER', 'GUEST'];

const permissionList = Object.entries(permissionLabels).map(
  ([permission, meta]) => ({
    permission: permission as Permission,
    ...meta
  })
);

export default function AdminUsersPage() {
  const { data: currentUser } = useAuth();
  const [role, setRole] = useState('ALL');
  const [page] = useState(1);
  const [isAddUserOpen, setIsAddUserOpen] = useState(false);

  const { data, isLoading } = useQuery<UsersResponse>({
    queryKey: ['admin', 'users', role, page],
    queryFn: async () => {
      const params = new URLSearchParams({ page: String(page), limit: '50' });
      if (role !== 'ALL') params.append('role', role);
      const res = await api.get(`/admin/users?${params.toString()}`);
      return res.data;
    }
  });

  const { data: roles } = useQuery<Role[]>({
    queryKey: ['admin', 'roles'],
    queryFn: async () => {
      const res = await api.get('/admin/roles');
      return res.data;
    }
  });

  const canManagePermissions = currentUser?.role === 'ADMIN' || currentUser?.permissions?.includes(Permission.MANAGE_USERS);

  return (
    <AdminListLayout
      title="Users"
      description="Manage members, back-office users and permissions."
      action={
        canManagePermissions ? (
          <button
            type="button"
            onClick={() => setIsAddUserOpen(true)}
            className="inline-flex items-center gap-2 rounded-xl bg-neon-blue px-4 py-2 text-sm font-semibold text-white transition-transform hover:scale-[1.02]"
          >
            <Plus className="h-4 w-4" />
            Add Back-Office User
          </button>
        ) : undefined
      }
    >
      <div className="glass-card p-6">
        <div className="mb-4 flex flex-col gap-4 sm:flex-row sm:items-center">
          <div className="flex items-center gap-2 text-slate-600 dark:text-slate-400">
            <User className="h-4 w-4" />
            <span className="text-sm font-medium">Role filter</span>
          </div>
          <select
            value={role}
            onChange={(e) => setRole(e.target.value)}
            className="rounded-xl border border-white/10 bg-white px-4 py-2 text-sm text-slate-900 outline-none focus:border-neon-blue dark:bg-slate-900 dark:text-slate-100"
          >
            {platformRoles.map((r) => (
              <option key={r} value={r} className="bg-white text-slate-900 dark:bg-slate-900 dark:text-slate-100">
                {r === 'ALL' ? 'All roles' : r}
              </option>
            ))}
          </select>
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
                  <th className="py-3 font-medium">Name</th>
                  <th className="py-3 font-medium">Email</th>
                  <th className="py-3 font-medium">Role</th>
                  <th className="py-3 font-medium">Status</th>
                  <th className="py-3 font-medium">Joined</th>
                  <th className="py-3 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {data?.items.map((user, idx) => (
                  <motion.tr
                    key={user.id}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: idx * 0.03 }}
                  >
                    <td className="py-3 font-medium">{user.name}</td>
                    <td className="py-3 text-slate-600 dark:text-slate-400">{user.email}</td>
                    <td className="py-3">
                      <span className="rounded-full bg-neon-gold/10 px-2 py-1 text-xs font-semibold text-neon-gold">
                        {user.role}
                      </span>
                    </td>
                    <td className="py-3">
                      <span
                        className={cn(
                          'rounded-full px-2 py-1 text-xs font-semibold',
                          user.status === 'BANNED'
                            ? 'bg-red-500/10 text-red-400'
                            : 'bg-green-500/10 text-green-400'
                        )}
                      >
                        {user.status === 'BANNED' ? 'BANNED' : 'ACTIVE'}
                      </span>
                    </td>
                    <td className="py-3 text-slate-600 dark:text-slate-400">
                      {new Date(user.createdAt).toLocaleDateString('en-GB')}
                    </td>
                    <td className="py-3">
                      <Link
                        href={`/admin/users/${user.id}/profile`}
                        className="inline-flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-medium text-neon-blue hover:bg-neon-blue/10"
                      >
                        <Eye className="h-3.5 w-3.5" /> View
                      </Link>
                    </td>
                  </motion.tr>
                ))}
              </tbody>
            </table>
            {!data?.items.length && (
              <div className="mt-8 text-center text-slate-500">No users found.</div>
            )}
          </div>
        )}
      </div>

      <AnimatePresence>
        {isAddUserOpen && (
          <AddBackOfficeUserModal
            roles={roles ?? []}
            onClose={() => setIsAddUserOpen(false)}
          />
        )}
      </AnimatePresence>
    </AdminListLayout>
  );
}

interface AddBackOfficeUserModalProps {
  roles: Role[];
  onClose: () => void;
}

function AddBackOfficeUserModal({ roles, onClose }: AddBackOfficeUserModalProps) {
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<'existing' | 'invite'>('existing');
  const [search, setSearch] = useState('');
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [roleId, setRoleId] = useState('');
  const [selectedPermissions, setSelectedPermissions] = useState<Set<Permission>>(new Set());
  const [sendInvite, setSendInvite] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [inviteForm, setInviteForm] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: ''
  });

  const { data: candidates, isLoading: candidatesLoading } = useQuery<UserItem[]>({
    queryKey: ['admin', 'users', 'candidates', search],
    queryFn: async () => {
      if (!search.trim()) return [];
      const res = await api.get(`/admin/users?limit=20&search=${encodeURIComponent(search.trim())}`);
      return res.data.items;
    },
    enabled: tab === 'existing' && search.trim().length > 0
  });

  const addExistingMutation = useMutation({
    mutationFn: async () => {
      const res = await api.post('/admin/back-office-users/existing', {
        userId: selectedUserId,
        roleId: roleId || undefined,
        permissions: Array.from(selectedPermissions),
        sendInvite
      });
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'users'] });
      onClose();
    },
    onError: (err) => setError(getApiErrorMessage(err))
  });

  const inviteMutation = useMutation({
    mutationFn: async () => {
      const res = await api.post('/admin/back-office-users/invite', {
        ...inviteForm,
        roleId: roleId || undefined,
        permissions: Array.from(selectedPermissions),
        sendInvite
      });
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'users'] });
      onClose();
    },
    onError: (err) => setError(getApiErrorMessage(err))
  });

  const togglePermission = (permission: Permission) => {
    setSelectedPermissions((prev) => {
      const next = new Set(prev);
      if (next.has(permission)) next.delete(permission);
      else next.add(permission);
      return next;
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (tab === 'existing') {
      if (!selectedUserId) {
        setError('Please select an existing user');
        return;
      }
      addExistingMutation.mutate();
    } else {
      if (!inviteForm.firstName || !inviteForm.lastName || !inviteForm.email) {
        setError('Please fill in all required fields');
        return;
      }
      inviteMutation.mutate();
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.96 }}
        transition={{ type: 'tween', duration: 0.15 }}
        className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-white/10 bg-slate-950 p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-6 flex items-center justify-between">
          <h2 className="text-xl font-bold">Add Back-Office User</h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-slate-400 hover:bg-white/5 hover:text-slate-200"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="mb-6 flex rounded-xl border border-white/10 p-1">
          <button
            type="button"
            onClick={() => setTab('existing')}
            className={cn(
              'flex-1 rounded-lg py-2 text-sm font-medium transition-colors',
              tab === 'existing' ? 'bg-neon-blue text-white' : 'text-slate-400 hover:text-slate-200'
            )}
          >
            Existing User
          </button>
          <button
            type="button"
            onClick={() => setTab('invite')}
            className={cn(
              'flex-1 rounded-lg py-2 text-sm font-medium transition-colors',
              tab === 'invite' ? 'bg-neon-blue text-white' : 'text-slate-400 hover:text-slate-200'
            )}
          >
            Invite New
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {tab === 'existing' ? (
            <div>
              <label className="mb-2 block text-sm font-medium text-slate-300">Search existing users</label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => {
                    setSearch(e.target.value);
                    setSelectedUserId(null);
                  }}
                  placeholder="Search by name or email"
                  className="w-full rounded-xl border border-white/10 bg-white/5 py-2.5 pl-10 pr-4 text-sm text-slate-100 outline-none focus:border-neon-blue"
                />
              </div>
              {candidatesLoading ? (
                <div className="mt-2 flex justify-center py-4">
                  <Loader2 className="h-5 w-5 animate-spin text-neon-blue" />
                </div>
              ) : (
                <div className="mt-2 max-h-48 space-y-1 overflow-y-auto rounded-xl border border-white/10 bg-white/5 p-2">
                  {candidates?.map((u) => (
                    <button
                      key={u.id}
                      type="button"
                      onClick={() => setSelectedUserId(u.id)}
                      className={cn(
                        'flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm transition-colors',
                        selectedUserId === u.id
                          ? 'bg-neon-blue/20 text-neon-blue'
                          : 'hover:bg-white/5'
                      )}
                    >
                      <span>
                        {u.name} <span className="text-slate-500">{u.email}</span>
                      </span>
                      {selectedUserId === u.id && <Check className="h-4 w-4" />}
                    </button>
                  ))}
                  {!candidates?.length && search.trim() && (
                    <p className="px-3 py-2 text-sm text-slate-500">No users found.</p>
                  )}
                </div>
              )}
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-2 block text-sm font-medium text-slate-300">First Name</label>
                <input
                  type="text"
                  value={inviteForm.firstName}
                  onChange={(e) => setInviteForm((f) => ({ ...f, firstName: e.target.value }))}
                  className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-slate-100 outline-none focus:border-neon-blue"
                  required
                />
              </div>
              <div>
                <label className="mb-2 block text-sm font-medium text-slate-300">Last Name</label>
                <input
                  type="text"
                  value={inviteForm.lastName}
                  onChange={(e) => setInviteForm((f) => ({ ...f, lastName: e.target.value }))}
                  className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-slate-100 outline-none focus:border-neon-blue"
                  required
                />
              </div>
              <div className="sm:col-span-2">
                <label className="mb-2 block text-sm font-medium text-slate-300">Email</label>
                <input
                  type="email"
                  value={inviteForm.email}
                  onChange={(e) => setInviteForm((f) => ({ ...f, email: e.target.value }))}
                  className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-slate-100 outline-none focus:border-neon-blue"
                  required
                />
              </div>
              <div className="sm:col-span-2">
                <label className="mb-2 block text-sm font-medium text-slate-300">Phone (optional)</label>
                <input
                  type="text"
                  value={inviteForm.phone}
                  onChange={(e) => setInviteForm((f) => ({ ...f, phone: e.target.value }))}
                  className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-slate-100 outline-none focus:border-neon-blue"
                />
              </div>
            </div>
          )}

          <div>
            <label className="mb-2 block text-sm font-medium text-slate-300">Back-Office Role</label>
            <select
              value={roleId}
              onChange={(e) => setRoleId(e.target.value)}
              className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-slate-100 outline-none focus:border-neon-blue"
            >
              <option value="">No role</option>
              {roles.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-slate-300">Additional Permissions</label>
            <div className="grid gap-2 sm:grid-cols-2">
              {permissionList.map((def) => {
                const checked = selectedPermissions.has(def.permission);
                return (
                  <button
                    key={def.permission}
                    type="button"
                    onClick={() => togglePermission(def.permission)}
                    className={cn(
                      'flex items-start gap-3 rounded-xl border p-3 text-left transition-colors',
                      checked
                        ? 'border-neon-blue/30 bg-neon-blue/10'
                        : 'border-white/10 bg-white/5 hover:bg-white/[0.07]'
                    )}
                  >
                    <div
                      className={cn(
                        'mt-0.5 flex h-5 w-5 flex-shrink-0 items-center justify-center rounded border',
                        checked ? 'border-neon-blue bg-neon-blue text-white' : 'border-slate-500 bg-transparent'
                      )}
                    >
                      {checked && <Check className="h-3.5 w-3.5" />}
                    </div>
                    <div>
                      <div className="text-sm font-medium text-slate-200">{def.label}</div>
                      <div className="text-xs text-slate-500">{def.description}</div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          <label className="flex items-center gap-3">
            <input
              type="checkbox"
              checked={sendInvite}
              onChange={(e) => setSendInvite(e.target.checked)}
              className="h-4 w-4 rounded border-slate-500 bg-transparent text-neon-blue focus:ring-neon-blue"
            />
            <span className="text-sm text-slate-300">Send invite email with password setup link</span>
          </label>

          {error && (
            <div className="rounded-xl bg-red-500/10 p-3 text-sm text-red-400">
              {error}
            </div>
          )}

          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl px-5 py-2.5 text-sm font-medium text-slate-400 hover:bg-white/5"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={addExistingMutation.isPending || inviteMutation.isPending}
              className="inline-flex items-center gap-2 rounded-xl bg-neon-blue px-5 py-2.5 text-sm font-semibold text-white transition-transform hover:scale-[1.02] disabled:opacity-60"
            >
              {(addExistingMutation.isPending || inviteMutation.isPending) && (
                <Loader2 className="h-4 w-4 animate-spin" />
              )}
              <Mail className="h-4 w-4" />
              {tab === 'existing' ? 'Add User' : 'Send Invite'}
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
}
