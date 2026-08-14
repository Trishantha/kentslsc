'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { cn } from '@/lib/utils';
import { Permission } from '@kentslsc/shared';
import type { AuthUser } from '@/hooks/useAuth';
import {
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
  Menu,
  Loader2,
  Globe,
  Settings,
  Shield,
  ChevronDown,
  ChevronRight
} from 'lucide-react';
import { AdminMobileMenu } from '@/components/layout/AdminMobileMenu';

interface NavItem {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  permission?: Permission | Permission[];
}

interface NavGroup {
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  items: NavItem[];
}

const navGroups: NavGroup[] = [
  {
    label: 'Overview',
    icon: LayoutDashboard,
    items: [
      { href: '/admin', label: 'Dashboard', icon: LayoutDashboard, permission: Permission.VIEW_ADMIN_DASHBOARD }
    ]
  },
  {
    label: 'Content',
    icon: FileText,
    items: [
      { href: '/admin/hero', label: 'Hero', icon: FileText, permission: Permission.MANAGE_HERO },
      { href: '/admin/pages', label: 'Pages', icon: FileText, permission: Permission.MANAGE_PAGES },
      { href: '/admin/blog', label: 'Blog', icon: Newspaper, permission: Permission.MANAGE_BLOG }
    ]
  },
  {
    label: 'Community',
    icon: Calendar,
    items: [
      { href: '/admin/events', label: 'Events', icon: Calendar, permission: Permission.MANAGE_EVENTS },
      { href: '/admin/fundraisers', label: 'Fundraisers', icon: HeartHandshake, permission: Permission.MANAGE_FUNDRAISERS },
      { href: '/admin/directory', label: 'Directory', icon: Building2, permission: Permission.MANAGE_DIRECTORY },
      { href: '/admin/jobs', label: 'Jobs', icon: Briefcase, permission: Permission.MANAGE_JOBS },
      { href: '/admin/forum', label: 'Forum Moderation', icon: MessageSquareWarning, permission: Permission.MANAGE_FORUM },
      { href: '/admin/contact', label: 'Contact Messages', icon: Mail, permission: Permission.MANAGE_CONTACT_MESSAGES }
    ]
  },
  {
    label: 'Membership',
    icon: Users,
    items: [
      { href: '/admin/users', label: 'Users', icon: Users, permission: Permission.MANAGE_USERS },
      { href: '/admin/roles', label: 'Roles', icon: Shield, permission: Permission.MANAGE_USERS },
      { href: '/admin/membership-types', label: 'Membership Types', icon: CreditCard, permission: Permission.MANAGE_MEMBERSHIPS },
      { href: '/admin/memberships', label: 'Memberships', icon: CreditCard, permission: Permission.MANAGE_MEMBERSHIPS }
    ]
  },
  {
    label: 'Finance',
    icon: CreditCard,
    items: [
      { href: '/admin/payments', label: 'Payments', icon: CreditCard, permission: Permission.MANAGE_PAYMENTS }
    ]
  },
  {
    label: 'Settings',
    icon: Settings,
    items: [
      { href: '/admin/site-settings', label: 'Social & Contact', icon: Globe, permission: Permission.MANAGE_SITE_SETTINGS },
      { href: '/admin/committee', label: 'Committee', icon: Users, permission: Permission.MANAGE_COMMITTEE }
    ]
  }
];

function canSeeItem(user: AuthUser | null, item: NavItem): boolean {
  if (!user) return false;
  if (user.role === 'ADMIN') return true;
  if (!item.permission) return true;
  const perms = Array.isArray(item.permission) ? item.permission : [item.permission];
  const userPermissions = new Set(user.permissions ?? []);
  return perms.some((p) => userPermissions.has(p));
}

function canSeeGroup(user: AuthUser | null, group: NavGroup): boolean {
  const visible = group.items.filter((item) => canSeeItem(user, item));
  return visible.length > 0;
}

function filterGroups(user: AuthUser | null): NavGroup[] {
  if (!user || user.role === 'ADMIN') return navGroups;
  return navGroups
    .filter((group) => canSeeGroup(user, group))
    .map((group) => ({ ...group, items: group.items.filter((item) => canSeeItem(user, item)) }));
}

function isActive(pathname: string, href: string) {
  return pathname === href || pathname?.startsWith(`${href}/`);
}

export function AdminShell({ children }: { children: React.ReactNode }) {
  const { data: user, isLoading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const visibleGroups = useMemo(() => filterGroups(user ?? null), [user]);

  const initiallyOpen = useMemo(() => {
    return visibleGroups
      .filter((group) => group.items.some((item) => isActive(pathname || '', item.href)))
      .map((group) => group.label);
  }, [visibleGroups, pathname]);

  const [openGroups, setOpenGroups] = useState<string[]>(initiallyOpen);

  useEffect(() => {
    setOpenGroups((prev) => {
      const next = new Set(prev);
      for (const group of visibleGroups) {
        if (group.items.some((item) => isActive(pathname || '', item.href))) {
          next.add(group.label);
        }
      }
      return Array.from(next);
    });
  }, [visibleGroups, pathname]);

  // Authorisation already happened server-side in layout.tsx; this only covers
  // the case where a session is revoked mid-visit during a client navigation.
  // Any user with at least one back-office permission is allowed to stay.
  useEffect(() => {
    if (!isLoading && !user) {
      router.replace('/auth/login');
    }
  }, [user, isLoading, router]);

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-neon-blue" />
      </div>
    );
  }

  if (!user) {
    return null;
  }

  const toggleGroup = (label: string) => {
    setOpenGroups((prev) =>
      prev.includes(label) ? prev.filter((l) => l !== label) : [...prev, label]
    );
  };

  return (
    <div className="flex min-h-screen flex-col md:flex-row">
      <aside className="sticky top-[68px] z-30 w-full border-b border-white/10 bg-slate-900/80 backdrop-blur-lg md:fixed md:top-[68px] md:flex md:h-[calc(100vh-68px)] md:w-64 md:flex-col md:border-b-0 md:border-r">
        <div className="flex items-center justify-between px-4 py-4 md:p-6">
          <Link href="/admin" className="text-xl font-extrabold gradient-text">
            Admin
          </Link>
          <button
            type="button"
            onClick={() => setMobileMenuOpen(true)}
            className="rounded-lg p-2 text-slate-300 hover:bg-white/10 md:hidden"
            aria-label="Open admin menu"
          >
            <Menu className="h-5 w-5" />
          </button>
        </div>
        <nav className="hidden flex-col gap-1 px-4 pb-4 md:flex md:flex-1 md:overflow-y-auto md:pb-0">
          {visibleGroups.map((group) => {
            const GroupIcon = group.icon;
            const expanded = openGroups.includes(group.label);
            const groupActive = group.items.some((item) => isActive(pathname || '', item.href));
            return (
              <div key={group.label} className="mb-1">
                <button
                  type="button"
                  onClick={() => toggleGroup(group.label)}
                  className={cn(
                    'flex w-full items-center gap-3 rounded-xl px-4 py-2.5 text-sm font-semibold transition-colors',
                    groupActive
                      ? 'text-neon-blue'
                      : 'text-slate-300 hover:bg-white/5 hover:text-white'
                  )}
                >
                  <GroupIcon className="h-4 w-4" />
                  <span className="flex-1 text-left">{group.label}</span>
                  {expanded ? (
                    <ChevronDown className="h-3.5 w-3.5 text-slate-500" />
                  ) : (
                    <ChevronRight className="h-3.5 w-3.5 text-slate-500" />
                  )}
                </button>
                {expanded && (
                  <div className="mt-1 flex flex-col gap-0.5 pl-4">
                    {group.items.map((item) => {
                      const Icon = item.icon;
                      const active = isActive(pathname || '', item.href);
                      return (
                        <Link
                          key={item.href}
                          href={item.href}
                          className={cn(
                            'flex items-center gap-3 rounded-xl px-4 py-2 text-sm font-medium transition-colors',
                            active
                              ? 'bg-neon-blue/10 text-neon-blue'
                              : 'text-slate-400 hover:bg-white/5 hover:text-white'
                          )}
                        >
                          <Icon className="h-4 w-4" />
                          {item.label}
                        </Link>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </nav>
      </aside>
      <main className="flex-1 p-4 pt-20 md:ml-64 md:p-8 md:pt-8">
        {children}
      </main>
      <AdminMobileMenu
        isOpen={mobileMenuOpen}
        onClose={() => setMobileMenuOpen(false)}
        groups={visibleGroups}
      />
    </div>
  );
}
