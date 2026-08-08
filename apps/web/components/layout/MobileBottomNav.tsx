'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, Calendar, Briefcase, Menu } from 'lucide-react';
import { cn } from '@/lib/utils';

const tabs = [
  { href: '/', label: 'Home', icon: Home },
  { href: '/events', label: 'Events', icon: Calendar },
  { href: '/directory', label: 'Directory', icon: Briefcase }
];

interface MobileBottomNavProps {
  onMenuOpen: () => void;
}

export function MobileBottomNav({ onMenuOpen }: MobileBottomNavProps) {
  const pathname = usePathname();
  const isAdmin = pathname?.startsWith('/admin');

  if (isAdmin) return null;

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-40 border-t border-slate-300 bg-white/90 pb-[env(safe-area-inset-bottom)] pt-2 shadow-[0_-4px_20px_rgba(0,0,0,0.08)] backdrop-blur-xl md:hidden dark:border-white/10 dark:bg-slate-950/80"
      aria-label="Mobile bottom navigation"
    >
      <div className="flex items-center justify-around px-2">
        {tabs.map((tab) => {
          const isActive = pathname === tab.href || pathname?.startsWith(`${tab.href}/`);
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={cn(
                'flex flex-1 flex-col items-center justify-center gap-0.5 rounded-xl py-1.5 transition-colors',
                isActive
                  ? 'text-neon-blue'
                  : 'text-slate-600 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200'
              )}
            >
              <tab.icon className={cn('h-5 w-5', isActive && 'stroke-[2.5px]')} />
              <span className="text-[10px] font-medium">{tab.label}</span>
            </Link>
          );
        })}
        <button
          type="button"
          onClick={onMenuOpen}
          className="flex flex-1 flex-col items-center justify-center gap-0.5 rounded-xl py-1.5 text-slate-600 transition-colors hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200"
        >
          <Menu className="h-5 w-5" />
          <span className="text-[10px] font-medium">More</span>
        </button>
      </div>
    </nav>
  );
}
