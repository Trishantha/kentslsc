'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';

export interface AdminDetailTab {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}

interface AdminDetailTabsProps {
  tabs: AdminDetailTab[];
  basePath: string;
}

export function AdminDetailTabs({ tabs, basePath }: AdminDetailTabsProps) {
  const pathname = usePathname();

  return (
    <nav className="mb-6 flex flex-wrap gap-2 border-b border-white/10 pb-1">
      {tabs.map((tab) => {
        const href = `${basePath}/${tab.href}`;
        const active = pathname === href || pathname?.startsWith(`${href}/`);
        const Icon = tab.icon;
        return (
          <Link
            key={tab.href}
            href={href}
            className={cn(
              'inline-flex items-center gap-2 border-b-2 px-3 py-2.5 text-sm font-medium transition-colors',
              active
                ? 'border-neon-blue text-neon-blue'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            )}
          >
            <Icon className="h-4 w-4" />
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
