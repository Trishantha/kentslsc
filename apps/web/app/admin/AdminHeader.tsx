'use client';

import Link from 'next/link';
import Image from 'next/image';
import { Menu, LogOut, ArrowLeft } from 'lucide-react';
import { useSignOut } from '@/hooks/useAuth';
import { cn } from '@/lib/utils';

interface AdminHeaderProps {
  onMenuOpen: () => void;
}

export function AdminHeader({ onMenuOpen }: AdminHeaderProps) {
  const signOut = useSignOut();

  return (
    <header className="sticky top-0 z-40 w-full border-b border-white/10 bg-slate-900/80 backdrop-blur-lg">
      <div className="flex h-[68px] items-center justify-between gap-3 px-4 md:px-6">
        {/* Logo and admin title */}
        <Link href="/" className="flex items-center gap-3">
          <span className="relative flex h-10 w-10 items-center justify-center overflow-hidden rounded-full bg-white/5">
            <Image
              src="/logo.png"
              alt="Kent SLSC logo"
              width={40}
              height={40}
              className="h-full w-full object-contain"
            />
          </span>
          <span className="hidden text-lg font-extrabold gradient-text md:inline">
            Admin
          </span>
        </Link>

        {/* Website link, sign out and mobile menu */}
        <div className="flex items-center gap-2 md:gap-4">
          <Link
            href="/"
            className="flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium text-slate-300 transition-colors hover:bg-white/10 hover:text-white"
          >
            <ArrowLeft className="h-4 w-4" />
            <span className="hidden md:inline">Back to website</span>
          </Link>

          <button
            type="button"
            onClick={() => signOut.mutate()}
            disabled={signOut.isPending}
            className={cn(
              'flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium text-red-400 transition-colors hover:bg-red-500/10',
              signOut.isPending && 'opacity-60'
            )}
          >
            <LogOut className="h-4 w-4" />
            <span className="hidden md:inline">
              {signOut.isPending ? 'Signing out...' : 'Sign out'}
            </span>
          </button>

          <button
            type="button"
            onClick={onMenuOpen}
            className="rounded-lg p-2 text-slate-300 transition-colors hover:bg-white/10 md:hidden"
            aria-label="Open admin menu"
          >
            <Menu className="h-5 w-5" />
          </button>
        </div>
      </div>
    </header>
  );
}
