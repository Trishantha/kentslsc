'use client';

import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import {
  Users,
  CreditCard,
  Calendar,
  Building2,
  HeartHandshake,
  Newspaper,
  Mail,
  Flag,
  Loader2
} from 'lucide-react';
import { api } from '@/lib/api';

interface DashboardStats {
  users: number;
  memberships: number;
  pendingMemberships: number;
  events: number;
  listings: number;
  fundraisers: number;
  blogPosts: number;
  contactMessages: number;
  flaggedForumItems: number;
}

const cards = [
  { key: 'users', label: 'Users', icon: Users, href: '/admin/users' },
  { key: 'memberships', label: 'Memberships', icon: CreditCard, href: '/admin/memberships' },
  { key: 'pendingMemberships', label: 'Pending Memberships', icon: CreditCard, href: '/admin/memberships' },
  { key: 'events', label: 'Events', icon: Calendar, href: '/admin/events' },
  { key: 'listings', label: 'Business Listings', icon: Building2, href: '/admin/directory' },
  { key: 'fundraisers', label: 'Fundraisers', icon: HeartHandshake, href: '/admin/fundraisers' },
  { key: 'blogPosts', label: 'Blog Posts', icon: Newspaper, href: '/admin/blog' },
  { key: 'contactMessages', label: 'Contact Messages', icon: Mail, href: '/admin/contact' },
  { key: 'flaggedForumItems', label: 'Flagged Forum Items', icon: Flag, href: '/admin/forum' }
];

export default function AdminDashboardPage() {
  const { data: stats, isLoading } = useQuery<DashboardStats>({
    queryKey: ['admin', 'dashboard'],
    queryFn: async () => {
      const res = await api.get('/admin/dashboard');
      return res.data;
    }
  });

  if (isLoading) {
    return (
      <div className="flex h-96 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-neon-blue" />
      </div>
    );
  }

  return (
    <div>
      <h1 className="section-title">Admin Dashboard</h1>
      <p className="mt-2 text-slate-600 dark:text-slate-400">
        Overview of platform activity and moderation queues.
      </p>
      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {cards.map((card, idx) => {
          const Icon = card.icon;
          const value = stats?.[card.key as keyof DashboardStats] ?? 0;
          return (
            <motion.a
              key={card.key}
              href={card.href}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.05 }}
              className="glass-card p-6 hover:scale-[1.02]"
            >
              <div className="flex items-center gap-3">
                <div className="rounded-xl bg-neon-blue/10 p-2 text-neon-blue">
                  <Icon className="h-5 w-5" />
                </div>
                <span className="text-sm font-medium text-slate-600 dark:text-slate-400">
                  {card.label}
                </span>
              </div>
              <p className="mt-4 text-3xl font-bold">{value}</p>
            </motion.a>
          );
        })}
      </div>
    </div>
  );
}
