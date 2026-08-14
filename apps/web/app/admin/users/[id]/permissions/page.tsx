'use client';

import { useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Loader2, Shield, Check } from 'lucide-react';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';
import { Permission, permissionLabels, UserRole } from '@kentslsc/shared';
import { useAuth } from '@/hooks/useAuth';
import type { Role, UserPermissionsDetail } from '../../types';

const permissionList = Object.entries(permissionLabels).map(
  ([permission, meta]) => ({
    permission: permission as Permission,
    ...meta
  })
);

const sections = Array.from(new Set(permissionList.map((p) => p.section)));

function groupBySection(list: typeof permissionList) {
  const grouped: Record<string, typeof permissionList> = {};
  for (const item of list) {
    const section = grouped[item.section] ?? [];
    section.push(item);
    grouped[item.section] = section;
  }
  return grouped;
}

const groupedPermissions = groupBySection(permissionList);

export default function UserPermissionsPage() {
  const { id } = useParams<{ id: string }>();
  const { data: currentUser } = useAuth();
  const queryClient = useQueryClient();

  const { data: detail, isLoading: detailLoading } = useQuery<UserPermissionsDetail>({
    queryKey: ['admin', 'users', id, 'permissions'],
    queryFn: async () => {
      const res = await api.get(`/admin/users/${id}/permissions`);
      return res.data;
    },
    enabled: !!id
  });

  const { data: roles, isLoading: rolesLoading } = useQuery<Role[]>({
    queryKey: ['admin', 'roles'],
    queryFn: async () => {
      const res = await api.get('/admin/roles');
      return res.data;
    }
  });

  const assignRoleMutation = useMutation({
    mutationFn: async ({ userId, roleId }: { userId: string; roleId: string | null }) => {
      const res = await api.post(`/admin/users/${userId}/role`, { roleId });
      return res.data as UserPermissionsDetail;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'users', id, 'permissions'] });
    }
  });

  const setPermissionsMutation = useMutation({
    mutationFn: async ({ userId, permissions }: { userId: string; permissions: Permission[] }) => {
      const res = await api.put(`/admin/users/${userId}/permissions`, { permissions });
      return res.data as UserPermissionsDetail;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'users', id, 'permissions'] });
    }
  });

  const { data: userDetail } = useQuery<{ role: string }>({
    queryKey: ['admin', 'users', id],
    queryFn: async () => {
      const res = await api.get(`/admin/users/${id}`);
      return res.data;
    },
    enabled: !!id
  });

  const canManagePermissions = currentUser?.role === UserRole.ADMIN || currentUser?.permissions?.includes(Permission.MANAGE_USERS);
  const isAdmin = userDetail?.role === UserRole.ADMIN;

  if (detailLoading || rolesLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-neon-blue" />
      </div>
    );
  }

  if (!canManagePermissions) {
    return (
      <div className="max-w-3xl">
        <section className="glass-card p-5">
          <h3 className="mb-4 flex items-center gap-2 text-lg font-semibold">
            <Shield className="h-5 w-5 text-neon-blue" /> Back-Office Permissions
          </h3>
          <p className="text-sm text-slate-500">You do not have permission to manage user permissions.</p>
        </section>
      </div>
    );
  }

  if (isAdmin) {
    return (
      <div className="max-w-3xl">
        <section className="glass-card p-5">
          <h3 className="mb-4 flex items-center gap-2 text-lg font-semibold">
            <Shield className="h-5 w-5 text-neon-blue" /> Back-Office Permissions
          </h3>
          <p className="text-sm text-slate-500">Platform administrators have all permissions automatically.</p>
        </section>
      </div>
    );
  }

  return (
    <div className="max-w-3xl">
      <section className="glass-card p-5">
        <div className="mb-4 flex items-center gap-2">
          <Shield className="h-5 w-5 text-neon-blue" />
          <h3 className="text-lg font-semibold">Back-Office Permissions</h3>
        </div>

        <div className="space-y-5">
          <div>
            <label className="mb-2 block text-sm font-medium text-slate-300">Assigned Role</label>
            <select
              value={detail?.roleId ?? ''}
              onChange={(e) => assignRoleMutation.mutate({ userId: id, roleId: e.target.value || null })}
              disabled={assignRoleMutation.isPending}
              className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-slate-100 outline-none focus:border-neon-blue disabled:opacity-60"
            >
              <option value="">No role</option>
              {(roles ?? []).map((role) => (
                <option key={role.id} value={role.id}>
                  {role.name}
                </option>
              ))}
            </select>
            <p className="mt-1 text-xs text-slate-500">
              A role grants its permissions automatically. Direct overrides are ticked below.
            </p>
          </div>

          <PermissionCheckboxes
            permissionsDetail={detail}
            onSetPermissions={(permissions) => setPermissionsMutation.mutate({ userId: id, permissions })}
            isSaving={setPermissionsMutation.isPending}
          />
        </div>
      </section>
    </div>
  );
}

interface PermissionCheckboxesProps {
  permissionsDetail?: UserPermissionsDetail;
  onSetPermissions: (permissions: Permission[]) => void;
  isSaving: boolean;
}

function PermissionCheckboxes({ permissionsDetail, onSetPermissions, isSaving }: PermissionCheckboxesProps) {
  const [selected, setSelected] = useState<Set<Permission>>(new Set());

  const directPermissions = useMemo(
    () => new Set(permissionsDetail?.direct ?? []),
    [permissionsDetail?.direct]
  );

  const effectivePermissions = useMemo(
    () => new Set(permissionsDetail?.effective ?? []),
    [permissionsDetail?.effective]
  );

  const handleToggle = (permission: Permission) => {
    setSelected((prev) => {
      const next = new Set(prev.size ? prev : directPermissions);
      if (next.has(permission)) {
        next.delete(permission);
      } else {
        next.add(permission);
      }
      return next;
    });
  };

  const handleSave = () => {
    const next = selected.size ? Array.from(selected) : Array.from(directPermissions);
    onSetPermissions(next);
    setSelected(new Set());
  };

  const hasChanges = selected.size > 0;

  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <label className="text-sm font-medium text-slate-300">Direct Permissions</label>
        {hasChanges && (
          <button
            type="button"
            onClick={handleSave}
            disabled={isSaving}
            className="inline-flex items-center gap-1 rounded-lg bg-neon-blue px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-60"
          >
            {isSaving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
            Save changes
          </button>
        )}
      </div>

      <div className="space-y-5">
        {sections.map((section) => (
          <div key={section}>
            <h4 className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-500">
              {section}
            </h4>
            <div className="grid gap-2 sm:grid-cols-2">
              {(groupedPermissions[section] ?? []).map((def) => {
                const isDirect = directPermissions.has(def.permission);
                const isInherited = effectivePermissions.has(def.permission) && !isDirect;
                const isChecked =
                  selected.size > 0
                    ? selected.has(def.permission)
                    : isDirect || isInherited;
                return (
                  <button
                    key={def.permission}
                    type="button"
                    onClick={() => handleToggle(def.permission)}
                    disabled={isInherited}
                    className={cn(
                      'flex items-start gap-3 rounded-xl border p-3 text-left transition-colors',
                      isInherited
                        ? 'cursor-not-allowed border-white/5 bg-white/[0.03] opacity-60'
                        : isDirect
                          ? 'border-neon-blue/30 bg-neon-blue/10'
                          : 'border-white/10 bg-white/5 hover:bg-white/[0.07]'
                    )}
                  >
                    <div
                      className={cn(
                        'mt-0.5 flex h-5 w-5 flex-shrink-0 items-center justify-center rounded border',
                        isChecked
                          ? 'border-neon-blue bg-neon-blue text-white'
                          : 'border-slate-500 bg-transparent'
                      )}
                    >
                      {isChecked && <Check className="h-3.5 w-3.5" />}
                    </div>
                    <div>
                      <div className="flex items-center gap-2 text-sm font-medium text-slate-200">
                        {def.label}
                        {isInherited && (
                          <span className="rounded-full bg-slate-500/20 px-1.5 py-0.5 text-[10px] text-slate-400">
                            role
                          </span>
                        )}
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
  );
}
