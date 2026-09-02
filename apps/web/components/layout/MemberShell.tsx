'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { Loader2, ChevronDown, ChevronRight } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { cn } from '@/lib/utils';
import { MemberHeader } from './MemberHeader';
import { MemberMobileMenu, type NavGroup } from './MemberMobileMenu';
import {
  LayoutDashboard,
  User,
  CreditCard,
  Users,
  Ticket,
  Receipt,
  Calendar,
  MessageSquare,
  Briefcase,
  HeartHandshake
} from 'lucide-react';

const navGroups: NavGroup[] = [
  {
    label: 'Overview',
    icon: LayoutDashboard,
    items: [{ href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard }]
  },
  {
    label: 'Account',
    icon: User,
    items: [
      { href: '/dashboard/profile', label: 'Profile', icon: User },
      { href: '/dashboard/membership', label: 'Membership', icon: CreditCard },
      { href: '/dashboard/dependants', label: 'Dependants', icon: Users }
    ]
  },
  {
    label: 'My Activity',
    icon: Ticket,
    items: [
      { href: '/dashboard/tickets', label: 'Tickets', icon: Ticket },
      { href: '/dashboard/purchases', label: 'Purchases', icon: Receipt }
    ]
  },
  {
    label: 'Community',
    icon: Calendar,
    items: [
      { href: '/events', label: 'Events', icon: Calendar },
      { href: '/forum', label: 'Forum', icon: MessageSquare },
      { href: '/directory', label: 'Directory', icon: Briefcase },
      { href: '/fundraisers/my-campaigns', label: 'My campaigns', icon: HeartHandshake }
    ]
  }
];

function isActive(pathname: string, href: string) {
  if (pathname === href) return true;
  if (href === '/dashboard') return false;
  return pathname?.startsWith(`${href}/`);
}

export function MemberShell({ children }: { children: React.ReactNode }) {
  const { data: user, isLoading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const initiallyOpen = useMemo(() => {
    return navGroups
      .filter((group) => group.items.some((item) => isActive(pathname || '', item.href)))
      .map((group) => group.label);
  }, [pathname]);

  const [openGroups, setOpenGroups] = useState<string[]>(initiallyOpen);

  useEffect(() => {
    setOpenGroups((prev) => {
      const next = new Set(prev);
      for (const group of navGroups) {
        if (group.items.some((item) => isActive(pathname || '', item.href))) {
          next.add(group.label);
        }
      }
      return Array.from(next);
    });
  }, [pathname]);

  // requireSession already guards server-side; this covers revoked mid-visit.
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
    <div className="flex min-h-screen flex-col">
      <MemberHeader onMenuOpen={() => setMobileMenuOpen(true)} />
      <aside className="hidden md:fixed md:top-[68px] md:z-30 md:flex md:h-[calc(100vh-68px)] md:w-64 md:flex-col md:border-b-0 md:border-r md:border-white/10 md:bg-slate-900/80 md:backdrop-blur-lg">
        <div className="flex items-center justify-between px-4 py-4 md:p-6">
          <Link href="/dashboard" className="text-xl font-extrabold gradient-text">
            Dashboard
          </Link>
        </div>
        <nav className="hidden flex-col gap-1 px-4 pb-4 md:flex md:flex-1 md:overflow-y-auto md:pb-0">
          {navGroups.map((group) => {
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
      <main className="flex-1 p-4 pt-20 md:ml-64 md:p-8 md:pt-24">{children}</main>
      <MemberMobileMenu
        isOpen={mobileMenuOpen}
        onClose={() => setMobileMenuOpen(false)}
        groups={navGroups}
      />
    </div>
  );
}
