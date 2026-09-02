'use client';

import Link from 'next/link';
import { motion } from 'framer-motion';
import { Briefcase, Ticket, Store, MessageSquare } from 'lucide-react';

const quickActions = [
  {
    href: '/directory',
    title: 'Post a job',
    description: 'Publish opportunities from your business profile.',
    icon: Briefcase
  },
  {
    href: '/events',
    title: 'Buy tickets',
    description: 'Reserve seats for upcoming events and activities.',
    icon: Ticket
  },
  {
    href: '/directory',
    title: 'Promote business',
    description: 'Boost visibility for your business listing.',
    icon: Store
  },
  {
    href: '/forum',
    title: 'Join the forum',
    description: 'Ask questions and connect with other members.',
    icon: MessageSquare
  }
] as const;

export function QuickActions() {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {quickActions.map((action, index) => {
        const Icon = action.icon;
        return (
          <motion.div
            key={action.title}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.03 * index }}
          >
            <Link
              href={action.href}
              className="glass-card block h-full p-5 transition-transform hover:-translate-y-1"
            >
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-neon-blue/15 text-neon-blue">
                <Icon className="h-5 w-5" />
              </div>
              <h3 className="mt-4 text-lg font-semibold">{action.title}</h3>
              <p className="mt-2 text-sm text-slate-700 dark:text-slate-400">{action.description}</p>
            </Link>
          </motion.div>
        );
      })}
    </div>
  );
}
