'use client';

import NextLink from 'next/link';
import { Link, usePathname } from '@/i18n/routing';
import Image from 'next/image';
import { useEffect, useState } from 'react';
import { Menu } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { ThemeToggle } from '@/components/ui/ThemeToggle';
import { LanguageSwitcher } from '@/components/ui/LanguageSwitcher';
import NeonLava from '@/components/ui/NeonLava';
import { FeatureGate } from '@/components/ui/FeatureGate';
import { MembershipFeature } from '@kentslsc/shared';
import { useAuth, useSignOut } from '@/hooks/useAuth';
import { cn } from '@/lib/utils';

interface NavbarProps {
  onMenuOpen: () => void;
}

export function Navbar({ onMenuOpen }: NavbarProps) {
  const t = useTranslations('nav');
  const [scrolled, setScrolled] = useState(false);
  const pathname = usePathname();
  const isAdmin = pathname?.startsWith('/admin') ?? false;
  const compact = scrolled || isAdmin || pathname !== '/';
  const { data: user } = useAuth();
  const signOut = useSignOut();
  const canAccessAdmin =
    user && (user.role === 'ADMIN' || user.permissions.length > 0);

  const publicNavLinks = [
    { href: '/', label: t('home') },
    { href: '/events', label: t('events') },
    { href: '/directory', label: t('directory') },
    { href: '/fundraisers', label: t('fundraising') },
    { href: '/blog', label: t('blog') },
    { href: '/about', label: t('about') },
    { href: '/contact', label: t('contact') }
  ] as const;

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 10);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <header
      className={cn(
        'relative sticky top-0 z-50 overflow-visible transition-all duration-300',
        compact
          ? 'bg-white/85 shadow-sm backdrop-blur-2xl dark:bg-slate-950/85'
          : ''
      )}
    >
      {!compact && <NeonLava className="z-0" />}
      {!compact && (
        <div className="pointer-events-none absolute inset-x-0 bottom-0 z-0 h-20 bg-gradient-to-b from-transparent to-slate-950/80" />
      )}
      <nav className="relative z-10 mx-auto flex h-[68px] max-w-7xl items-center justify-between overflow-visible px-4 md:px-8">
        {/* Desktop logo + text */}
        <Link href="/" className="relative hidden items-center gap-3 md:flex">
          <span className="relative flex h-11 w-11 items-start justify-start overflow-visible">
            <Image
              src="/logo-v2.png"
              alt={t('logoAlt')}
              width={compact ? 44 : 144}
              height={compact ? 44 : 144}
              className={cn(
                'max-w-none rounded-full object-contain transition-all duration-300',
                compact ? 'h-11 w-11' : 'h-32 w-32 md:h-36 md:w-36'
              )}
            />
          </span>
          <span
            className={cn(
              'font-futuristic whitespace-nowrap text-xl tracking-tight transition-all duration-300',
              compact ? 'pl-0' : 'pl-20 md:pl-24'
            )}
          >
            <span className="neon-glass-text">KENT</span>{' '}
            <span className="text-neon-gold">SLSC</span>
          </span>
        </Link>

        {/* Desktop links / auth */}
        <div className="hidden items-center gap-8 md:flex">
          {publicNavLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={cn(
                'whitespace-nowrap text-xs font-medium transition-colors hover:text-neon-blue hover:drop-shadow-[0_0_8px_rgba(6,182,212,0.8)]',
                compact
                  ? 'text-slate-700 dark:text-slate-300'
                  : 'text-white drop-shadow-md'
              )}
            >
              {link.label}
            </Link>
          ))}
          <FeatureGate feature={MembershipFeature.FORUM_READ}>
            <NextLink
              href="/forum"
              className={cn(
                'whitespace-nowrap text-xs font-medium transition-colors hover:text-neon-blue hover:drop-shadow-[0_0_8px_rgba(6,182,212,0.8)]',
                compact
                  ? 'text-slate-700 dark:text-slate-300'
                  : 'text-white drop-shadow-md'
              )}
            >
              {t('forum')}
            </NextLink>
          </FeatureGate>
          <Link
            href="/membership"
            className={cn(
              'whitespace-nowrap text-xs font-medium transition-colors hover:text-neon-blue hover:drop-shadow-[0_0_8px_rgba(6,182,212,0.8)]',
              compact
                ? 'text-slate-700 dark:text-slate-300'
                : 'text-white drop-shadow-md'
            )}
          >
            {t('membership')}
          </Link>
          {user ? (
            <>
              <NextLink href="/dashboard" className="btn-primary whitespace-nowrap px-4 py-2 text-xs">
                {t('dashboard')}
              </NextLink>
              {canAccessAdmin && (
                <NextLink
                  href="/admin"
                  className="whitespace-nowrap rounded-xl border border-neon-gold/60 bg-amber-100/80 px-4 py-2 text-xs font-semibold text-amber-900 transition-transform hover:scale-105 dark:bg-transparent dark:text-neon-gold"
                >
                  {t('adminDashboard')}
                </NextLink>
              )}
              <button
                onClick={() => signOut.mutate()}
                disabled={signOut.isPending}
                className={cn(
                  'whitespace-nowrap text-xs font-medium transition-colors',
                  compact
                    ? 'text-slate-700 hover:text-red-600 dark:text-slate-300'
                    : 'text-white hover:text-red-300 drop-shadow-md'
                )}
              >
                {signOut.isPending ? t('loggingOut') : t('logout')}
              </button>
            </>
          ) : (
            <Link
              href="/auth/login"
              className={cn(
                'whitespace-nowrap rounded-xl border px-4 py-2 text-xs font-semibold transition-transform hover:scale-105',
                compact
                  ? 'border-neon-gold/60 bg-amber-100/80 text-amber-900 dark:bg-transparent dark:text-neon-gold'
                  : 'border-white/50 text-white drop-shadow-md'
              )}
            >
              {t('login')}
            </Link>
          )}
          <LanguageSwitcher
            className={cn(
              'hidden md:flex',
              compact ? 'text-slate-700 dark:text-slate-300' : 'text-white'
            )}
          />
          <ThemeToggle
            className={cn(compact ? 'text-slate-700 dark:text-slate-300' : 'text-white')}
          />
        </div>

        {/* Mobile layouts with cross-fade */}
        <div className="relative h-full w-full md:hidden">
          {/* Mobile hero logo */}
          <div
            className={cn(
              'absolute inset-x-0 top-0 flex justify-center transition-all duration-300 ease-in-out',
              compact
                ? 'pointer-events-none -translate-y-5 scale-[0.8] opacity-0'
                : 'translate-y-0 scale-100 opacity-100'
            )}
          >
            <Link
              href="/"
              className="relative top-[25px] flex h-[132px] w-[132px] items-center justify-center"
            >
              <Image
                src="/logo-v2.png"
                alt={t('logoAlt')}
                fill
                sizes="132px"
                className="rounded-full object-contain transition-all duration-300"
              />
            </Link>
          </div>

          {/* Mobile normal header */}
          <div
            className={cn(
              'absolute inset-x-0 top-0 flex h-full items-center justify-between text-slate-800 transition-all duration-300 ease-in-out dark:text-slate-200',
              compact
                ? 'pointer-events-auto translate-y-0 opacity-100'
                : 'pointer-events-none -translate-y-2.5 opacity-0'
            )}
          >
            <Link href="/" className="relative flex items-center gap-3">
              <span className="relative flex h-11 w-11 items-start justify-start overflow-visible">
                <Image
                  src="/logo-v2.png"
                  alt={t('logoAlt')}
                  fill
                  sizes="44px"
                  className="max-w-none rounded-full object-contain transition-all duration-300"
                />
              </span>
              <span className="font-futuristic whitespace-nowrap text-xl tracking-tight">
                <span className="neon-glass-text">KENT</span>{' '}
                <span className="text-neon-gold">SLSC</span>
              </span>
            </Link>

            <div className="flex items-center gap-2">
              <LanguageSwitcher />
              <ThemeToggle />
              <button
                onClick={onMenuOpen}
                className="rounded-lg p-2 hover:bg-slate-200 dark:hover:bg-black/30"
                aria-label={t('openMenu')}
              >
                <Menu className="h-6 w-6" />
              </button>
            </div>
          </div>
        </div>
      </nav>
    </header>
  );
}
