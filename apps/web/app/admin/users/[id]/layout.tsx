'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import {
  ArrowLeft,
  User,
  Mail,
  Shield,
  CreditCard,
  Ticket,
  Heart,
  Store,
  MessageSquare,
  Receipt,
  Users,
  Loader2
} from 'lucide-react';
import { api, getApiErrorMessage } from '@/lib/api';
import { AdminDetailTabs } from '@/components/admin/AdminDetailTabs';
import type { UserDetail } from '../types';

const tabs = [
  { href: 'profile', label: 'Profile', icon: User },
  { href: 'permissions', label: 'Permissions', icon: Shield },
  { href: 'memberships', label: 'Memberships', icon: CreditCard },
  { href: 'dependants', label: 'Dependants', icon: Users },
  { href: 'tickets', label: 'Tickets', icon: Ticket },
  { href: 'donations', label: 'Donations', icon: Heart },
  { href: 'transactions', label: 'Transactions', icon: Receipt },
  { href: 'listings', label: 'Listings', icon: Store },
  { href: 'forum', label: 'Forum', icon: MessageSquare }
];

interface UserDetailLayoutProps {
  children: React.ReactNode;
}

export default function UserDetailLayout({ children }: UserDetailLayoutProps) {
  const { id } = useParams<{ id: string }>();

  const {
    data: user,
    isLoading,
    error
  } = useQuery<UserDetail>({
    queryKey: ['admin', 'users', id],
    queryFn: async () => {
      const res = await api.get(`/admin/users/${id}`);
      return res.data;
    },
    enabled: !!id
  });

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-neon-blue" />
      </div>
    );
  }

  if (error || !user) {
    return (
      <div className="glass-card p-8 text-center">
        <h2 className="text-xl font-semibold text-red-400">Could not load user</h2>
        <p className="mt-2 text-slate-500">
          {error ? getApiErrorMessage(error) : 'User not found.'}
        </p>
        <Link
          href="/admin/users"
          className="mt-6 inline-flex items-center gap-2 text-sm font-medium text-neon-blue hover:underline"
        >
          <ArrowLeft className="h-4 w-4" /> Back to users
        </Link>
      </div>
    );
  }

  return (
    <div>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <Link
            href="/admin/users"
            className="mt-1 rounded-lg p-2 text-slate-500 hover:bg-white/5 hover:text-slate-300"
          >
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div>
            <h1 className="section-title">{user.name}</h1>
            <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-slate-500">
              <Mail className="h-3.5 w-3.5" />
              <span>{user.email}</span>
              <span>·</span>
              <span className="rounded-full bg-neon-gold/10 px-2 py-0.5 text-xs font-semibold text-neon-gold">
                {user.role}
              </span>
              {user.status === 'BANNED' && (
                <span className="rounded-full bg-red-500/10 px-2 py-0.5 text-xs font-semibold text-red-400">
                  BANNED
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="mt-4">
        <AdminDetailTabs tabs={tabs} basePath={`/admin/users/${id}`} />
      </div>

      {children}
    </div>
  );
}
