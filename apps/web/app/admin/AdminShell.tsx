'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { cn } from '@/lib/utils';
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
  Loader2
} from 'lucide-react';
import { AdminMobileMenu } from '@/components/layout/AdminMobileMenu';

const navItems = [
  { href: '/admin', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/admin/hero', label: 'Hero', icon: FileText },
  { href: '/admin/pages', label: 'Pages', icon: FileText },
  { href: '/admin/users', label: 'Users', icon: Users },
  { href: '/admin/membership-types', label: 'Membership Types', icon: CreditCard },
  { href: '/admin/memberships', label: 'Memberships', icon: CreditCard },
  { href: '/admin/events', label: 'Events', icon: Calendar },
  { href: '/admin/directory', label: 'Directory', icon: Building2 },
  { href: '/admin/jobs', label: 'Jobs', icon: Briefcase },
  { href: '/admin/fundraisers', label: 'Fundraisers', icon: HeartHandshake },
  { href: '/admin/payments', label: 'Payments', icon: CreditCard },
  { href: '/admin/blog', label: 'Blog', icon: Newspaper },
  { href: '/admin/forum', label: 'Forum Moderation', icon: MessageSquareWarning },
  { href: '/admin/contact', label: 'Contact Messages', icon: Mail }
];

export function AdminShell({ children }: { children: React.ReactNode }) {
  const { data: user, isLoading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Authorisation already happened server-side in layout.tsx; this only covers
  // the case where a session is revoked mid-visit during a client navigation.
  useEffect(() => {
    if (!isLoading && (!user || user.role !== 'ADMIN')) {
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

  if (!user || user.role !== 'ADMIN') {
    return null;
  }

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
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = pathname === item.href || pathname?.startsWith(`${item.href}/`);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  'flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium transition-colors',
                  active
                    ? 'bg-neon-blue/10 text-neon-blue'
                    : 'text-slate-300 hover:bg-white/5 hover:text-white'
                )}
              >
                <Icon className="h-4 w-4" />
                {item.label}
              </Link>
            );
          })}
        </nav>
      </aside>
      <main className="flex-1 p-4 pt-20 md:ml-64 md:p-8 md:pt-8">
        {children}
      </main>
      <AdminMobileMenu isOpen={mobileMenuOpen} onClose={() => setMobileMenuOpen(false)} />
    </div>
  );
}
