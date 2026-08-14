'use client';

import { useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Loader2,
  Search,
  User,
  X,
  Eye,
  CreditCard,
  Ticket,
  Store,
  Heart,
  MessageSquare,
  FileText,
  Plus,
  Shield,
  Check,
  Mail
} from 'lucide-react';
import { api, getApiErrorMessage } from '@/lib/api';
import { Permission, permissionLabels, UserRole } from '@kentslsc/shared';
import { useAuth } from '@/hooks/useAuth';

interface StructuredAddress {
  buildingStreet: string;
  locality?: string;
  townCity: string;
  postcode: string;
}

interface MembershipItem {
  id: string;
  membershipId: string;
  status: string;
  startDate: string;
  endDate: string;
  membershipCardUrl: string | null;
  qrCodeValue: string | null;
  dependantsJson: unknown;
  createdAt: string;
  membershipType: {
    name: string;
    description?: string | null;
    price: number;
    isFree: boolean;
    durationMonths: number;
  };
}

interface TicketItem {
  id: string;
  status: string;
  purchaseDatetime: string;
  stripeSessionId: string | null;
  event: {
    title: string;
    startDatetime: string;
  };
}

interface DonationItem {
  id: string;
  amount: number;
  message?: string | null;
  donatedAt: string;
  fundraiser: {
    title: string;
  };
}

interface ListingItem {
  id: string;
  businessName: string;
  category?: string | null;
  isPaid: boolean;
  isPromoted: boolean;
  createdAt: string;
}

interface ForumTopicItem {
  id: string;
  title: string;
  createdAt: string;
}

interface ForumPostItem {
  id: string;
  content: string;
  createdAt: string;
}

interface UserItem {
  id: string;
  name: string;
  email: string;
  role: string;
  createdAt: string;
}

interface UserDetail extends UserItem {
  firstName?: string | null;
  lastName?: string | null;
  phone?: string | null;
  address?: StructuredAddress | null;
  updatedAt: string;
  memberships: MembershipItem[];
  tickets: TicketItem[];
  listings: ListingItem[];
  donations: DonationItem[];
  topics: ForumTopicItem[];
  posts: ForumPostItem[];
}

interface UsersResponse {
  items: UserItem[];
  total: number;
  page: number;
  limit: number;
}

interface Role {
  id: string;
  name: string;
  description: string | null;
  permissions: { permission: Permission }[];
}

interface UserPermissionsDetail {
  roleId: string | null;
  direct: Permission[];
  inherited: Permission[];
  effective: Permission[];
}

const platformRoles = ['ALL', 'ADMIN', 'MEMBER', 'BUSINESS_OWNER', 'GUEST'];

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

function formatDate(value: string) {
  return new Date(value).toLocaleDateString('en-GB');
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' }).format(value);
}

function formatAddress(address?: StructuredAddress | null) {
  if (!address) return '-';
  const parts = [address.buildingStreet, address.locality, address.townCity, address.postcode].filter(Boolean);
  return parts.join(', ');
}

function cn(...classes: (string | false | undefined)[]) {
  return classes.filter(Boolean).join(' ');
}

export default function AdminUsersPage() {
  const { data: currentUser } = useAuth();
  const queryClient = useQueryClient();
  const [role, setRole] = useState('ALL');
  const [page] = useState(1);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
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

  const { data: detail, isLoading: detailLoading } = useQuery<UserDetail>({
    queryKey: ['admin', 'users', selectedUserId],
    queryFn: async () => {
      const res = await api.get(`/admin/users/${selectedUserId}`);
      return res.data;
    },
    enabled: !!selectedUserId
  });

  const { data: permissionsDetail, isLoading: permissionsLoading } = useQuery<UserPermissionsDetail>({
    queryKey: ['admin', 'users', selectedUserId, 'permissions'],
    queryFn: async () => {
      const res = await api.get(`/admin/users/${selectedUserId}/permissions`);
      return res.data;
    },
    enabled: !!selectedUserId
  });

  const { data: roles } = useQuery<Role[]>({
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
      queryClient.invalidateQueries({ queryKey: ['admin', 'users', selectedUserId, 'permissions'] });
    }
  });

  const setPermissionsMutation = useMutation({
    mutationFn: async ({ userId, permissions }: { userId: string; permissions: Permission[] }) => {
      const res = await api.put(`/admin/users/${userId}/permissions`, { permissions });
      return res.data as UserPermissionsDetail;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'users', selectedUserId, 'permissions'] });
    }
  });

  const canManagePermissions = currentUser?.role === 'ADMIN' || currentUser?.permissions?.includes(Permission.MANAGE_USERS);

  return (
    <div>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="section-title">Users</h1>
        {canManagePermissions && (
          <button
            type="button"
            onClick={() => setIsAddUserOpen(true)}
            className="inline-flex items-center gap-2 rounded-xl bg-neon-blue px-4 py-2 text-sm font-semibold text-white transition-transform hover:scale-[1.02]"
          >
            <Plus className="h-4 w-4" />
            Add Back-Office User
          </button>
        )}
      </div>

      <div className="mt-6 glass-card p-6">
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
                    <td className="py-3 text-slate-600 dark:text-slate-400">
                      {new Date(user.createdAt).toLocaleDateString('en-GB')}
                    </td>
                    <td className="py-3">
                      <button
                        type="button"
                        onClick={() => setSelectedUserId(user.id)}
                        className="inline-flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-medium text-neon-blue hover:bg-neon-blue/10"
                      >
                        <Eye className="h-3.5 w-3.5" /> View
                      </button>
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
        {selectedUserId && (
          <div
            className="fixed inset-0 z-50 flex justify-end bg-black/60 p-0 backdrop-blur-sm"
            onClick={() => setSelectedUserId(null)}
          >
            <motion.div
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'tween', duration: 0.25 }}
              className="h-full w-full max-w-2xl overflow-y-auto border-l border-white/10 bg-slate-950 p-6 shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="mb-6 flex items-center justify-between">
                <h2 className="text-2xl font-bold">User Details</h2>
                <button
                  type="button"
                  onClick={() => setSelectedUserId(null)}
                  className="rounded-lg p-2 text-slate-400 hover:bg-white/5 hover:text-slate-200"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              {detailLoading || !detail ? (
                <div className="flex h-64 items-center justify-center">
                  <Loader2 className="h-8 w-8 animate-spin text-neon-blue" />
                </div>
              ) : (
                <div className="space-y-6">
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
                        <dt className="text-slate-500">Joined</dt>
                        <dd className="font-medium">{formatDate(detail.createdAt)}</dd>
                      </div>
                    </dl>
                  </section>

                  {canManagePermissions && detail.role !== UserRole.ADMIN && (
                    <PermissionEditor
                      roles={roles ?? []}
                      permissionsDetail={permissionsDetail}
                      isLoading={permissionsLoading}
                      onAssignRole={(roleId) => assignRoleMutation.mutate({ userId: detail.id, roleId })}
                      onSetPermissions={(permissions) =>
                        setPermissionsMutation.mutate({ userId: detail.id, permissions })
                      }
                    />
                  )}

                  <section className="glass-card p-5">
                    <h3 className="mb-4 flex items-center gap-2 text-lg font-semibold">
                      <CreditCard className="h-5 w-5 text-neon-blue" /> Memberships
                    </h3>
                    {(detail.memberships ?? []).length === 0 ? (
                      <p className="text-sm text-slate-500">No memberships found.</p>
                    ) : (
                      <div className="space-y-3">
                        {(detail.memberships ?? []).map((m) => (
                          <div key={m.id} className="rounded-xl border border-white/10 bg-white/5 p-4 text-sm">
                            <div className="flex items-center justify-between">
                              <span className="font-semibold">{m.membershipType.name}</span>
                              <span
                                className={cn(
                                  'rounded-full px-2 py-0.5 text-xs font-semibold',
                                  m.status === 'ACTIVE'
                                    ? 'bg-green-500/20 text-green-400'
                                    : m.status === 'PENDING'
                                      ? 'bg-yellow-500/20 text-yellow-400'
                                      : 'bg-slate-500/20 text-slate-400'
                                )}
                              >
                                {m.status}
                              </span>
                            </div>
                            <p className="mt-1 text-slate-500">
                              {m.membershipType.isFree ? 'Free / Lifetime' : formatCurrency(m.membershipType.price)} ·{' '}
                              {formatDate(m.startDate)} – {formatDate(m.endDate)}
                            </p>
                            <p className="mt-1 font-mono text-xs text-slate-500">{m.membershipId}</p>
                          </div>
                        ))}
                      </div>
                    )}
                  </section>

                  <section className="glass-card p-5">
                    <h3 className="mb-4 flex items-center gap-2 text-lg font-semibold">
                      <Ticket className="h-5 w-5 text-neon-blue" /> Tickets
                    </h3>
                    {(detail.tickets ?? []).length === 0 ? (
                      <p className="text-sm text-slate-500">No tickets found.</p>
                    ) : (
                      <div className="space-y-3">
                        {(detail.tickets ?? []).map((t) => (
                          <div key={t.id} className="rounded-xl border border-white/10 bg-white/5 p-4 text-sm">
                            <div className="font-semibold">{t.event.title}</div>
                            <p className="mt-1 text-slate-500">
                              {formatDate(t.event.startDatetime)} · Status: {t.status}
                            </p>
                            {t.stripeSessionId && (
                              <p className="mt-1 font-mono text-xs text-slate-500">Session: {t.stripeSessionId}</p>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </section>

                  <section className="glass-card p-5">
                    <h3 className="mb-4 flex items-center gap-2 text-lg font-semibold">
                      <Heart className="h-5 w-5 text-neon-blue" /> Donations
                    </h3>
                    {(detail.donations ?? []).length === 0 ? (
                      <p className="text-sm text-slate-500">No donations found.</p>
                    ) : (
                      <div className="space-y-3">
                        {(detail.donations ?? []).map((d) => (
                          <div key={d.id} className="rounded-xl border border-white/10 bg-white/5 p-4 text-sm">
                            <div className="flex items-center justify-between">
                              <span className="font-semibold">{d.fundraiser.title}</span>
                              <span className="font-semibold text-neon-gold">{formatCurrency(d.amount)}</span>
                            </div>
                            <p className="mt-1 text-slate-500">{formatDate(d.donatedAt)}</p>
                            {d.message && <p className="mt-1 text-slate-400">{d.message}</p>}
                          </div>
                        ))}
                      </div>
                    )}
                  </section>

                  <section className="glass-card p-5">
                    <h3 className="mb-4 flex items-center gap-2 text-lg font-semibold">
                      <Store className="h-5 w-5 text-neon-blue" /> Business Listings
                    </h3>
                    {(detail.listings ?? []).length === 0 ? (
                      <p className="text-sm text-slate-500">No business listings found.</p>
                    ) : (
                      <div className="space-y-3">
                        {(detail.listings ?? []).map((l) => (
                          <div key={l.id} className="rounded-xl border border-white/10 bg-white/5 p-4 text-sm">
                            <div className="flex items-center justify-between">
                              <span className="font-semibold">{l.businessName}</span>
                              <span className="text-xs text-slate-500">{l.category || 'No category'}</span>
                            </div>
                            <p className="mt-1 text-slate-500">
                              {l.isPaid ? 'Paid' : 'Free'} · {l.isPromoted ? 'Promoted' : 'Not promoted'} ·{' '}
                              {formatDate(l.createdAt)}
                            </p>
                          </div>
                        ))}
                      </div>
                    )}
                  </section>

                  <section className="glass-card p-5">
                    <h3 className="mb-4 flex items-center gap-2 text-lg font-semibold">
                      <MessageSquare className="h-5 w-5 text-neon-blue" /> Forum Activity
                    </h3>
                    {(detail.topics ?? []).length === 0 && (detail.posts ?? []).length === 0 ? (
                      <p className="text-sm text-slate-500">No forum activity found.</p>
                    ) : (
                      <div className="space-y-3">
                        {(detail.topics ?? []).map((t) => (
                          <div key={t.id} className="rounded-xl border border-white/10 bg-white/5 p-4 text-sm">
                            <div className="flex items-center gap-2">
                              <FileText className="h-4 w-4 text-slate-500" />
                              <span className="font-semibold">{t.title}</span>
                            </div>
                            <p className="mt-1 text-slate-500">Topic · {formatDate(t.createdAt)}</p>
                          </div>
                        ))}
                        {(detail.posts ?? []).map((p) => (
                          <div key={p.id} className="rounded-xl border border-white/10 bg-white/5 p-4 text-sm">
                            <div className="line-clamp-2 text-slate-300">{p.content}</div>
                            <p className="mt-1 text-slate-500">Post · {formatDate(p.createdAt)}</p>
                          </div>
                        ))}
                      </div>
                    )}
                  </section>
                </div>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {isAddUserOpen && (
          <AddBackOfficeUserModal
            roles={roles ?? []}
            onClose={() => setIsAddUserOpen(false)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

interface PermissionEditorProps {
  roles: Role[];
  permissionsDetail?: UserPermissionsDetail;
  isLoading: boolean;
  onAssignRole: (roleId: string | null) => void;
  onSetPermissions: (permissions: Permission[]) => void;
}

function PermissionEditor({ roles, permissionsDetail, isLoading, onAssignRole, onSetPermissions }: PermissionEditorProps) {
  const [selected, setSelected] = useState<Set<Permission>>(new Set());
  const [pendingRoleId, setPendingRoleId] = useState<string | null>(null);

  // Keep local selection in sync with server state
  const directPermissions = useMemo(
    () => new Set(permissionsDetail?.direct ?? []),
    [permissionsDetail?.direct]
  );

  const effectivePermissions = useMemo(
    () => new Set(permissionsDetail?.effective ?? []),
    [permissionsDetail?.effective]
  );

  const currentRoleId = permissionsDetail?.roleId ?? '';

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
    <section className="glass-card p-5">
      <div className="mb-4 flex items-center gap-2">
        <Shield className="h-5 w-5 text-neon-blue" />
        <h3 className="text-lg font-semibold">Back-Office Permissions</h3>
      </div>

      {isLoading ? (
        <div className="flex h-32 items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-neon-blue" />
        </div>
      ) : (
        <div className="space-y-5">
          <div>
            <label className="mb-2 block text-sm font-medium text-slate-300">Assigned Role</label>
            <select
              value={pendingRoleId ?? currentRoleId}
              onChange={(e) => {
                const roleId = e.target.value || null;
                setPendingRoleId(e.target.value);
                onAssignRole(roleId);
              }}
              className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-slate-100 outline-none focus:border-neon-blue"
            >
              <option value="">No role</option>
              {roles.map((role) => (
                <option key={role.id} value={role.id}>
                  {role.name}
                </option>
              ))}
            </select>
            <p className="mt-1 text-xs text-slate-500">
              A role grants its permissions automatically. Direct overrides are ticked below.
            </p>
          </div>

          <div>
            <div className="mb-3 flex items-center justify-between">
              <label className="text-sm font-medium text-slate-300">Direct Permissions</label>
              {hasChanges && (
                <button
                  type="button"
                  onClick={handleSave}
                  className="inline-flex items-center gap-1 rounded-lg bg-neon-blue px-3 py-1.5 text-xs font-semibold text-white"
                >
                  <Check className="h-3.5 w-3.5" /> Save changes
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
        </div>
      )}
    </section>
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
