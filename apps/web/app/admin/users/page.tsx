'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { Loader2, Search, User } from 'lucide-react';
import { api } from '@/lib/api';

interface UserItem {
  id: string;
  name: string;
  email: string;
  role: string;
  createdAt: string;
}

interface UsersResponse {
  items: UserItem[];
  total: number;
  page: number;
  limit: number;
}

const roles = ['ALL', 'ADMIN', 'MEMBER', 'BUSINESS_OWNER', 'GUEST'];

export default function AdminUsersPage() {
  const [role, setRole] = useState('ALL');
  const [page] = useState(1);
  const { data, isLoading } = useQuery<UsersResponse>({
    queryKey: ['admin', 'users', role, page],
    queryFn: async () => {
      const params = new URLSearchParams({ page: String(page), limit: '50' });
      if (role !== 'ALL') params.append('role', role);
      const res = await api.get(`/admin/users?${params.toString()}`);
      return res.data;
    }
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
            className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-slate-900 outline-none focus:border-neon-blue dark:text-slate-100"
          >
            {roles.map((r) => (
              <option key={r} value={r}>
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
    </div>
  );
}
