'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X,
  LayoutDashboard,
  Users,
  CreditCard,
  Calendar,
  Building2,
  Briefcase,
  HeartHandshake,
  Newspaper,
  MessageSquareWarning,
  Mail,
  FileText,
  ChevronRight,
  LogOut,
  ArrowLeft
} from 'lucide-react';
import { useAuth, useSignOut } from '@/hooks/useAuth';
import { cn } from '@/lib/utils';

interface AdminMobileMenuProps {
  isOpen: boolean;
  onClose: () => void;
}

const adminMenuItems = [
  { href: '/admin', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/admin/hero', label: 'Hero', icon: FileText },
  { href: '/admin/pages', label: 'Pages', icon: FileText },
  { href: '/admin/users', label: 'Users', icon: Users },
  { href: '/admin/membership-types', label: 'Membership Types', icon: CreditCard },
  { href: '/admin/memberships', label: 'Memberships', icon: CreditCard },
  { href: '/admin/events', label: 'Events', icon: Calendar },
  { href: '/admin/committee', label: 'Committee', icon: Users },
  { href: '/admin/directory', label: 'Directory', icon: Building2 },
  { href: '/admin/jobs', label: 'Jobs', icon: Briefcase },
  { href: '/admin/fundraisers', label: 'Fundraisers', icon: HeartHandshake },
  { href: '/admin/blog', label: 'Blog', icon: Newspaper },
  { href: '/admin/forum', label: 'Forum Moderation', icon: MessageSquareWarning },
  { href: '/admin/contact', label: 'Contact Messages', icon: Mail }
];

export function AdminMobileMenu({ isOpen, onClose }: AdminMobileMenuProps) {
  const pathname = usePathname();
  const { data: user } = useAuth();
  const signOut = useSignOut();

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[60] bg-slate-950/40 backdrop-blur-sm md:hidden"
          onClick={onClose}
        >
          <motion.div
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            onClick={(e) => e.stopPropagation()}
            className="absolute inset-x-0 bottom-0 flex max-h-[85vh] flex-col rounded-t-3xl bg-slate-100 pb-[env(safe-area-inset-bottom)] shadow-2xl dark:bg-slate-900"
            role="dialog"
            aria-modal="true"
            aria-label="Admin menu"
          >
            {/* Drag handle */}
            <div className="flex flex-shrink-0 justify-center pt-3 pb-1">
              <div className="h-1.5 w-10 rounded-full bg-slate-300 dark:bg-slate-700" />
            </div>

            {/* Header */}
            <div className="flex flex-shrink-0 items-center justify-between px-5 py-3">
              <div>
                <h2 className="text-lg font-bold">Admin</h2>
                {user && (
                  <p className="text-xs text-slate-600 dark:text-slate-400">
                    {user.name}
                  </p>
                )}
              </div>
              <button
                type="button"
                onClick={onClose}
                className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-300/50 text-slate-700 transition-colors hover:bg-slate-300 dark:bg-white/10 dark:text-slate-300 dark:hover:bg-white/20"
                aria-label="Close menu"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Scrollable content */}
            <div className="flex-1 min-h-0 overflow-y-auto px-5 pb-6">
              {/* Back to site link */}
              <Link
                href="/"
                onClick={onClose}
                className="mb-4 flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm font-medium text-slate-800 transition-colors hover:bg-slate-100 dark:border-white/10 dark:bg-white/5 dark:text-slate-200 dark:hover:bg-white/10"
              >
                <ArrowLeft className="h-4 w-4" />
                Back to website
              </Link>

              {/* Admin links */}
              <div className="space-y-2">
                {adminMenuItems.map((item) => {
                  const Icon = item.icon;
                  const isActive = pathname === item.href || pathname?.startsWith(`${item.href}/`);
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={onClose}
                      className={cn(
                        'flex items-center gap-4 rounded-2xl border p-4 transition-all active:scale-[0.98]',
                        isActive
                          ? 'border-neon-blue/30 bg-neon-blue/10 shadow-neon'
                          : 'border-slate-300 bg-white shadow-sm hover:bg-slate-100 dark:border-white/10 dark:bg-white/5 dark:hover:bg-white/10'
                      )}
                    >
                      <div
                        className={cn(
                          'flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl',
                          isActive ? 'bg-neon-blue text-white' : 'bg-neon-blue/10 text-neon-blue'
                        )}
                      >
                        <Icon className="h-5 w-5" />
                      </div>
                      <span className={cn('flex-1 font-semibold', isActive && 'text-neon-blue')}>
                        {item.label}
                      </span>
                      <ChevronRight className="h-5 w-5 flex-shrink-0 text-slate-500 dark:text-slate-400" />
                    </Link>
                  );
                })}
              </div>

              {/* Sign out */}
              <button
                type="button"
                onClick={() => {
                  onClose();
                  signOut.mutate();
                }}
                disabled={signOut.isPending}
                className="mt-6 flex w-full items-center justify-center gap-2 rounded-2xl border border-red-500/30 bg-red-500/20 px-4 py-3.5 font-medium text-red-700 transition-colors active:bg-red-500/30 dark:text-red-400"
              >
                <LogOut className="h-5 w-5" />
                {signOut.isPending ? 'Signing out...' : 'Sign out'}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
