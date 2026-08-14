'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X,
  ChevronRight,
  ChevronDown,
  LogOut,
  ArrowLeft
} from 'lucide-react';
import { useAuth, useSignOut } from '@/hooks/useAuth';
import { cn } from '@/lib/utils';

interface NavItem {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  permission?: unknown;
}

export interface NavGroup {
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  items: NavItem[];
}

interface AdminMobileMenuProps {
  isOpen: boolean;
  onClose: () => void;
  groups: NavGroup[];
}

function isActive(pathname: string, href: string) {
  return pathname === href || pathname?.startsWith(`${href}/`);
}

export function AdminMobileMenu({ isOpen, onClose, groups }: AdminMobileMenuProps) {
  const pathname = usePathname();
  const { data: user } = useAuth();
  const signOut = useSignOut();

  const initiallyOpen = useMemo(() => {
    return groups
      .filter((group) => group.items.some((item) => isActive(pathname || '', item.href)))
      .map((group) => group.label);
  }, [groups, pathname]);

  const [openGroups, setOpenGroups] = useState<string[]>(initiallyOpen);

  useEffect(() => {
    setOpenGroups((prev) => {
      const next = new Set(prev);
      for (const group of groups) {
        if (group.items.some((item) => isActive(pathname || '', item.href))) {
          next.add(group.label);
        }
      }
      return Array.from(next);
    });
  }, [groups, pathname]);

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

  const toggleGroup = (label: string) => {
    setOpenGroups((prev) =>
      prev.includes(label) ? prev.filter((l) => l !== label) : [...prev, label]
    );
  };

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

              {/* Grouped admin links */}
              <div className="space-y-3">
                {groups.map((group) => {
                  const GroupIcon = group.icon;
                  const expanded = openGroups.includes(group.label);
                  const groupActive = group.items.some((item) => isActive(pathname || '', item.href));
                  return (
                    <div
                      key={group.label}
                      className={cn(
                        'rounded-2xl border transition-colors',
                        groupActive
                          ? 'border-neon-blue/30 bg-neon-blue/5 dark:bg-neon-blue/10'
                          : 'border-slate-300 bg-white dark:border-white/10 dark:bg-white/5'
                      )}
                    >
                      <button
                        type="button"
                        onClick={() => toggleGroup(group.label)}
                        className="flex w-full items-center gap-3 px-4 py-3"
                      >
                        <div
                          className={cn(
                            'flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl',
                            groupActive ? 'bg-neon-blue text-white' : 'bg-neon-blue/10 text-neon-blue'
                          )}
                        >
                          <GroupIcon className="h-5 w-5" />
                        </div>
                        <span className={cn('flex-1 text-left font-semibold', groupActive && 'text-neon-blue')}>
                          {group.label}
                        </span>
                        {expanded ? (
                          <ChevronDown className="h-5 w-5 flex-shrink-0 text-slate-500 dark:text-slate-400" />
                        ) : (
                          <ChevronRight className="h-5 w-5 flex-shrink-0 text-slate-500 dark:text-slate-400" />
                        )}
                      </button>

                      <AnimatePresence initial={false}>
                        {expanded && (
                          <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: 'auto', opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            transition={{ duration: 0.2 }}
                            className="overflow-hidden"
                          >
                            <div className="space-y-1 px-3 pb-3">
                              {group.items.map((item) => {
                                const Icon = item.icon;
                                const active = isActive(pathname || '', item.href);
                                return (
                                  <Link
                                    key={item.href}
                                    href={item.href}
                                    onClick={onClose}
                                    className={cn(
                                      'flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors',
                                      active
                                        ? 'bg-neon-blue/10 text-neon-blue'
                                        : 'text-slate-600 hover:bg-white/50 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-white/10 dark:hover:text-white'
                                    )}
                                  >
                                    <Icon className="h-4 w-4" />
                                    {item.label}
                                  </Link>
                                );
                              })}
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
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
