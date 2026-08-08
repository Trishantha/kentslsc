'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import { Loader2, Search, User, X, Eye, CreditCard, Ticket, Store, Heart, MessageSquare, FileText } from 'lucide-react';
import { api } from '@/lib/api';

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

const roles = ['ALL', 'ADMIN', 'MEMBER', 'BUSINESS_OWNER', 'GUEST'];

function formatDate(value: string) {
  return new Date(value).toLocaleDateString('en-GB');
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' }).format(value);
}

function formatAddress(address?: StructuredAddress | null) {
  if (!address) return '-';
  const parts = [
    address.buildingStreet,
    address.locality,
    address.townCity,
    address.postcode
  ].filter(Boolean);
  return parts.join(', ');
}

export default function AdminUsersPage() {
  const [role, setRole] = useState('ALL');
  const [page] = useState(1);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);

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

  return (
    <div>
      <h1 className="section-title">Users</h1>
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
            {roles.map((r) => (
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
                                className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                                  m.status === 'ACTIVE'
                                    ? 'bg-green-500/20 text-green-400'
                                    : m.status === 'PENDING'
                                      ? 'bg-yellow-500/20 text-yellow-400'
                                      : 'bg-slate-500/20 text-slate-400'
                                }`}
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
    </div>
  );
}
