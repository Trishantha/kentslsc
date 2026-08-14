'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import { Loader2, Plus, Pencil, Trash2, X, Shield, Check } from 'lucide-react';
import { api } from '@/lib/api';
import { getApiErrorMessage } from '@/lib/api';
import { Permission, permissionLabels } from '@kentslsc/shared';

interface Role {
  id: string;
  name: string;
  description: string | null;
  permissions: { permission: Permission }[];
  createdAt: string;
  updatedAt: string;
}

interface PermissionDef {
  permission: Permission;
  label: string;
  description: string;
  section: string;
}

const permissionList: PermissionDef[] = Object.entries(permissionLabels).map(
  ([permission, meta]) => ({
    permission: permission as Permission,
    ...meta
  })
);

const sections = Array.from(new Set(permissionList.map((p) => p.section)));

function groupBySection(list: PermissionDef[]) {
  const grouped: Record<string, PermissionDef[]> = {};
  for (const item of list) {
    const section = grouped[item.section] ?? [];
    section.push(item);
    grouped[item.section] = section;
  }
  return grouped;
}

const groupedPermissions = groupBySection(permissionList);

export default function AdminRolesPage() {
  const queryClient = useQueryClient();
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingRole, setEditingRole] = useState<Role | null>(null);
  const [deletingRole, setDeletingRole] = useState<Role | null>(null);

  const { data: roles, isLoading } = useQuery<Role[]>({
    queryKey: ['admin', 'roles'],
    queryFn: async () => {
      const res = await api.get('/admin/roles');
      return res.data;
    }
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/admin/roles/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'roles'] });
      setDeletingRole(null);
    }
  });

  return (
    <div>
      <div className="flex items-center justify-between">
        <h1 className="section-title">Back-Office Roles</h1>
        <button
          type="button"
          onClick={() => setIsCreateOpen(true)}
          className="inline-flex items-center gap-2 rounded-xl bg-neon-blue px-4 py-2 text-sm font-semibold text-white transition-transform hover:scale-[1.02]"
        >
          <Plus className="h-4 w-4" />
          New Role
        </button>
      </div>
      <p className="mt-2 text-slate-600 dark:text-slate-400">
        Create reusable permission templates and assign them to back-office staff.
      </p>

      {isLoading ? (
        <div className="flex h-64 items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-neon-blue" />
        </div>
      ) : (
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {roles?.map((role, idx) => {
            const permissionCount = role.permissions.length;
            return (
              <motion.div
                key={role.id}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.05 }}
                className="glass-card p-5"
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="rounded-xl bg-neon-blue/10 p-2 text-neon-blue">
                      <Shield className="h-5 w-5" />
                    </div>
                    <div>
                      <h3 className="font-semibold">{role.name}</h3>
                      <p className="text-xs text-slate-500">
                        {permissionCount} permission{permissionCount === 1 ? '' : 's'}
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-1">
                    <button
                      type="button"
                      onClick={() => setEditingRole(role)}
                      className="rounded-lg p-2 text-slate-500 hover:bg-white/5 hover:text-neon-blue"
                      aria-label="Edit role"
                    >
                      <Pencil className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setDeletingRole(role)}
                      className="rounded-lg p-2 text-slate-500 hover:bg-white/5 hover:text-red-500"
                      aria-label="Delete role"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
                {role.description && (
                  <p className="mt-3 text-sm text-slate-600 dark:text-slate-400">
                    {role.description}
                  </p>
                )}
                <div className="mt-4 flex flex-wrap gap-2">
                  {role.permissions.slice(0, 6).map((p) => (
                    <span
                      key={p.permission}
                      className="rounded-full bg-neon-gold/10 px-2 py-0.5 text-xs font-medium text-neon-gold"
                    >
                      {permissionLabels[p.permission].label}
                    </span>
                  ))}
                  {permissionCount > 6 && (
                    <span className="rounded-full bg-slate-500/10 px-2 py-0.5 text-xs font-medium text-slate-500">
                      +{permissionCount - 6} more
                    </span>
                  )}
                </div>
              </motion.div>
            );
          })}
          {!roles?.length && (
            <div className="col-span-full py-12 text-center text-slate-500">
              No back-office roles yet.
            </div>
          )}
        </div>
      )}

      <AnimatePresence>
        {isCreateOpen && (
          <RoleModal
            mode="create"
            onClose={() => setIsCreateOpen(false)}
          />
        )}
        {editingRole && (
          <RoleModal
            mode="edit"
            role={editingRole}
            onClose={() => setEditingRole(null)}
          />
        )}
        {deletingRole && (
          <DeleteRoleModal
            role={deletingRole}
            onClose={() => setDeletingRole(null)}
            onConfirm={() => deleteMutation.mutate(deletingRole.id)}
            isDeleting={deleteMutation.isPending}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

interface RoleModalProps {
  mode: 'create' | 'edit';
  role?: Role;
  onClose: () => void;
}

function RoleModal({ mode, role, onClose }: RoleModalProps) {
  const queryClient = useQueryClient();
  const [name, setName] = useState(role?.name ?? '');
  const [description, setDescription] = useState(role?.description ?? '');
  const [selected, setSelected] = useState<Set<Permission>>(
    () => new Set(role?.permissions.map((p) => p.permission) ?? [])
  );
  const [error, setError] = useState<string | null>(null);

  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        name,
        description,
        permissions: Array.from(selected)
      };
      if (mode === 'edit') {
        await api.patch(`/admin/roles/${role!.id}`, payload);
      } else {
        await api.post('/admin/roles', payload);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'roles'] });
      onClose();
    },
    onError: (err) => {
      setError(getApiErrorMessage(err));
    }
  });

  const togglePermission = (permission: Permission) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(permission)) {
        next.delete(permission);
      } else {
        next.add(permission);
      }
      return next;
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!name.trim()) {
      setError('Role name is required');
      return;
    }
    saveMutation.mutate();
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
          <h2 className="text-xl font-bold">
            {mode === 'create' ? 'Create Role' : 'Edit Role'}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-slate-400 hover:bg-white/5 hover:text-slate-200"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label className="mb-2 block text-sm font-medium text-slate-300">Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-slate-100 outline-none focus:border-neon-blue"
              placeholder="e.g. Events Manager"
            />
          </div>
          <div>
            <label className="mb-2 block text-sm font-medium text-slate-300">Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-slate-100 outline-none focus:border-neon-blue"
              placeholder="What this role is for"
            />
          </div>

          <div>
            <label className="mb-3 block text-sm font-medium text-slate-300">Permissions</label>
            <div className="space-y-5">
              {sections.map((section) => (
                <div key={section}>
                  <h4 className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-500">
                    {section}
                  </h4>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {(groupedPermissions[section] ?? []).map((def) => {
                      const checked = selected.has(def.permission);
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
                              checked
                                ? 'border-neon-blue bg-neon-blue text-white'
                                : 'border-slate-500 bg-transparent'
                            )}
                          >
                            {checked && <Check className="h-3.5 w-3.5" />}
                          </div>
                          <div>
                            <div className="text-sm font-medium text-slate-200">
                              {def.label}
                            </div>
                            <div className="text-xs text-slate-500">{def.description}</div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>

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
              disabled={saveMutation.isPending}
              className="inline-flex items-center gap-2 rounded-xl bg-neon-blue px-5 py-2.5 text-sm font-semibold text-white transition-transform hover:scale-[1.02] disabled:opacity-60"
            >
              {saveMutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              {mode === 'create' ? 'Create Role' : 'Save Changes'}
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
}

function cn(...classes: (string | false | undefined)[]) {
  return classes.filter(Boolean).join(' ');
}

interface DeleteRoleModalProps {
  role: Role;
  onClose: () => void;
  onConfirm: () => void;
  isDeleting: boolean;
}

function DeleteRoleModal({ role, onClose, onConfirm, isDeleting }: DeleteRoleModalProps) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.96 }}
        className="w-full max-w-md rounded-2xl border border-white/10 bg-slate-950 p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-xl font-bold">Delete Role</h2>
        <p className="mt-2 text-sm text-slate-400">
          Are you sure you want to delete <span className="font-semibold text-slate-200">{role.name}</span>?
          Users currently assigned this role will keep their direct permissions but will lose inherited ones.
        </p>
        <div className="mt-6 flex justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl px-5 py-2.5 text-sm font-medium text-slate-400 hover:bg-white/5"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={isDeleting}
            className="inline-flex items-center gap-2 rounded-xl bg-red-500 px-5 py-2.5 text-sm font-semibold text-white transition-transform hover:scale-[1.02] disabled:opacity-60"
          >
            {isDeleting && <Loader2 className="h-4 w-4 animate-spin" />}
            Delete
          </button>
        </div>
      </motion.div>
    </div>
  );
}
