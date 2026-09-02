'use client';

import Link from 'next/link';
import { motion } from 'framer-motion';
import { CreditCard, Calendar, Users, Loader2, ArrowRight } from 'lucide-react';
import { formatDate } from '@/lib/utils';
import { useMyMembership } from './useMyMembership';

export function MembershipSummary() {
  const { data: membership, isLoading } = useMyMembership();

  if (isLoading) {
    return (
      <div className="glass-card flex items-center justify-center p-8">
        <Loader2 className="h-6 w-6 animate-spin text-neon-blue" />
      </div>
    );
  }

  if (!membership) {
    return null;
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="glass-card p-6"
    >
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <CreditCard className="h-6 w-6 text-neon-blue" />
          <h2 className="text-xl font-bold">Membership</h2>
        </div>
        <Link
          href="/dashboard/membership"
          className="inline-flex items-center text-sm font-medium text-neon-blue hover:underline"
        >
          Manage <ArrowRight className="ml-1 h-4 w-4" />
        </Link>
      </div>

      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-neon-blue/10 text-neon-blue">
            <CreditCard className="h-5 w-5" />
          </div>
          <div>
            <p className="text-xs text-slate-500 dark:text-slate-400">Plan</p>
            <p className="font-semibold">{membership.membershipType.name}</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-neon-blue/10 text-neon-blue">
            <Calendar className="h-5 w-5" />
          </div>
          <div>
            <p className="text-xs text-slate-500 dark:text-slate-400">Valid until</p>
            <p className="font-semibold">{membership.membershipType.isFree ? 'Lifetime' : formatDate(membership.endDate)}</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-neon-blue/10 text-neon-blue">
            <Users className="h-5 w-5" />
          </div>
          <div>
            <p className="text-xs text-slate-500 dark:text-slate-400">Dependants</p>
            <p className="font-semibold">{membership.dependantsCount}</p>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
