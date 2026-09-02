'use client';

import Link from 'next/link';
import { motion } from 'framer-motion';

export function BecomeMemberCTA() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.1 }}
      className="glass-card p-8 text-center"
    >
      <h2 className="text-xl font-bold">Become a Member</h2>
      <p className="mt-2 text-slate-700 dark:text-slate-400">
        You do not have an active membership yet. Join today to unlock member benefits.
      </p>
      <Link href="/membership" className="btn-primary mt-6 inline-block">
        View Membership Plans
      </Link>
    </motion.div>
  );
}
