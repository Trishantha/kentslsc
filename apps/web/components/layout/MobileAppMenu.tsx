'use client';

import NextLink from 'next/link';
import { Link, usePathname } from '@/i18n/routing';
import { useEffect } from 'react';
import { useTranslations } from 'next-intl';
import {
  X,
  User,
  LogOut,
  MessageSquare,
  Heart,
  Newspaper,
  Info,
  Mail,
  CreditCard,
  LayoutDashboard,
  ChevronRight,
  Shield,
  UserPlus,
  Siren
} from 'lucide-react';
import { useAuth, useSignOut } from '@/hooks/useAuth';
import { FeatureGate } from '@/components/ui/FeatureGate';
import { MembershipFeature } from '@kentslsc/shared';
import { cn, formatDate } from '@/lib/utils';

interface MobileAppMenuProps {
  isOpen: boolean;
  onClose: () => void;
}

interface MenuItem {
  href: string;
  label: string;
  description?: string;
  icon: React.ElementType;
  feature?: MembershipFeature | null;
  adminOnly?: boolean;
  external?: boolean;
}

function MenuCard({
  item,
  onClose,
  isActive
}: {
  item: MenuItem;
  onClose: () => void;
  isActive: boolean;
}) {
  const Icon = item.icon;
  const LinkComponent = item.external ? NextLink : Link;

  const content = (
    <LinkComponent
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
          'flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-xl',
          isActive ? 'bg-neon-blue text-white' : 'bg-neon-blue/10 text-neon-blue'
        )}
      >
        <Icon className="h-6 w-6" />
      </div>
      <div className="flex-1 min-w-0">
        <p className={cn('font-semibold', isActive && 'text-neon-blue')}>{item.label}</p>
        {item.description && (
          <p className="mt-0.5 text-sm text-slate-600 dark:text-slate-400">{item.description}</p>
        )}
      </div>
      <ChevronRight className="h-5 w-5 flex-shrink-0 text-slate-500 dark:text-slate-400" />
    </LinkComponent>
  );

  if (item.feature) {
    return (
      <FeatureGate feature={item.feature}>
        {content}
      </FeatureGate>
    );
  }

  return content;
}

export function MobileAppMenu({ isOpen, onClose }: MobileAppMenuProps) {
  const t = useTranslations('mobileMenu');
  const nav = useTranslations('nav');
  const pathname = usePathname();
  const { data: user, isLoading: userLoading } = useAuth();
  const signOut = useSignOut();

  const mainMenuItems: MenuItem[] = [
    {
      href: '/dashboard',
      label: t('myDashboard'),
      description: t('myDashboardDescription'),
      icon: LayoutDashboard,
      external: true
    },
    {
      href: '/membership',
      label: nav('membership'),
      description: t('membershipDescription'),
      icon: CreditCard
    },
    {
      href: '/forum',
      label: t('communityForum'),
      description: t('communityForumDescription'),
      icon: MessageSquare,
      feature: MembershipFeature.FORUM_READ,
      external: true
    }
  ];

  const secondaryMenuItems: MenuItem[] = [
    { href: '/emergency', label: nav('emergency'), icon: Siren },
    { href: '/fundraisers', label: nav('fundraising'), icon: Heart },
    { href: '/blog', label: nav('blog'), icon: Newspaper },
    { href: '/about', label: t('aboutUs'), icon: Info },
    { href: '/contact', label: nav('contact'), icon: Mail },
    { href: '/privacy', label: nav('privacy'), icon: Shield },
    { href: '/auth/login', label: t('joinTheClub'), icon: UserPlus }
  ];

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
    <div
      className={cn(
        'fixed inset-0 z-[60] bg-slate-950/40 backdrop-blur-sm transition-opacity duration-300 md:hidden',
        isOpen ? 'opacity-100' : 'pointer-events-none invisible opacity-0'
      )}
      onClick={onClose}
      aria-hidden={!isOpen}
    >
      <div
        className={cn(
          'absolute inset-x-0 bottom-0 flex max-h-[85vh] flex-col rounded-t-3xl bg-slate-100 pb-[env(safe-area-inset-bottom)] shadow-2xl transition-transform duration-300 ease-out dark:bg-slate-900',
          isOpen ? 'animate-sheet-slide-up' : 'translate-y-full'
        )}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={t('mainMenuLabel')}
      >
            {/* Drag handle */}
            <div className="flex flex-shrink-0 justify-center pt-3 pb-1">
              <div className="h-1.5 w-10 rounded-full bg-slate-300 dark:bg-slate-700" />
            </div>

            {/* Header */}
            <div className="flex flex-shrink-0 items-center justify-between px-5 py-3">
              <h2 className="text-lg font-bold">{t('title')}</h2>
              <button
                type="button"
                onClick={onClose}
                className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-300/50 text-slate-700 transition-colors hover:bg-slate-300 dark:bg-white/10 dark:text-slate-300 dark:hover:bg-white/20"
                aria-label={t('closeMenu')}
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Scrollable content */}
            <div className="flex-1 min-h-0 overflow-y-auto px-5 pb-24">
              {/* Profile card */}
              {userLoading ? (
                <div className="mb-6 animate-pulse rounded-2xl bg-slate-200/60 p-4 dark:bg-white/5">
                  <div className="flex items-center gap-4">
                    <div className="h-14 w-14 rounded-full bg-slate-200 dark:bg-slate-700" />
                    <div className="flex-1 space-y-2">
                      <div className="h-4 w-1/2 rounded bg-slate-200 dark:bg-slate-700" />
                      <div className="h-3 w-1/3 rounded bg-slate-200 dark:bg-slate-700" />
                    </div>
                  </div>
                </div>
              ) : user ? (
                <NextLink
                  href="/dashboard"
                  onClick={onClose}
                  className="mb-6 flex items-center gap-4 rounded-2xl border border-slate-300 bg-white p-4 shadow-sm transition-colors hover:bg-slate-100 dark:border-white/10 dark:bg-white/5 dark:hover:bg-white/10"
                >
                  <div className="flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-neon-blue to-emerald-600 text-white">
                    <User className="h-7 w-7" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="truncate font-semibold">{user.name}</p>
                    <p className="mt-0.5 text-sm text-slate-600 dark:text-slate-400">
                      {t('memberSince', { date: formatDate(user.createdAt) })}
                    </p>
                  </div>
                  <ChevronRight className="h-5 w-5 flex-shrink-0 text-slate-500 dark:text-slate-400" />
                </NextLink>
              ) : (
                <div className="mb-6 rounded-2xl border border-neon-gold/30 bg-gradient-to-r from-neon-gold/20 to-amber-500/20 p-4 dark:border-neon-gold/20 dark:from-neon-gold/10 dark:to-amber-500/10">
                  <p className="font-semibold text-amber-900 dark:text-amber-200">{t('joinCommunity')}</p>
                  <p className="mt-1 text-sm text-amber-800 dark:text-amber-300/80">
                    {t('joinCommunityDescription')}
                  </p>
                  <div className="mt-3 flex gap-3">
                    <Link
                      href="/auth/login"
                      onClick={onClose}
                      className="rounded-xl bg-amber-600 px-4 py-2 text-sm font-semibold text-white transition-transform hover:scale-105 active:scale-95"
                    >
                      {t('login')}
                    </Link>
                    <Link
                      href="/membership"
                      onClick={onClose}
                      className="rounded-xl border border-amber-600/50 px-4 py-2 text-sm font-semibold text-amber-900 transition-colors hover:bg-amber-600/20 dark:text-amber-300"
                    >
                      {t('join')}
                    </Link>
                  </div>
                </div>
              )}

              {/* Main menu cards */}
              <div className="space-y-3">
                {mainMenuItems
                  .filter((item) => {
                    const needsAuth = item.href === '/dashboard';
                    return !needsAuth || !!user;
                  })
                  .map((item) => (
                    <MenuCard
                      key={item.href}
                      item={item}
                      onClose={onClose}
                      isActive={pathname === item.href || (pathname?.startsWith(`${item.href}/`) ?? false)}
                    />
                  ))}
              </div>

              {/* Secondary links */}
              <h3 className="mt-6 px-1 text-sm font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-400">
                {t('more')}
              </h3>
              <div className="mt-3 rounded-2xl border border-slate-300 bg-white dark:border-white/10 dark:bg-white/5">
                {secondaryMenuItems.map((item, index) => {
                  const Icon = item.icon;
                  const LinkComponent = item.external ? NextLink : Link;
                  const isActive = pathname === item.href || pathname?.startsWith(`${item.href}/`);
                  return (
                    <LinkComponent
                      key={item.href}
                      href={item.href}
                      onClick={onClose}
                      className={cn(
                        'flex items-center gap-4 px-4 py-3.5 transition-colors active:bg-white/10',
                        index !== secondaryMenuItems.length - 1 && 'border-b border-slate-200 dark:border-white/10',
                        isActive ? 'text-neon-blue' : 'text-slate-700 dark:text-slate-200'
                      )}
                    >
                      <Icon className="h-5 w-5 flex-shrink-0" />
                      <span className="flex-1 font-medium">{item.label}</span>
                      <ChevronRight className="h-4 w-4 flex-shrink-0 text-slate-400" />
                    </LinkComponent>
                  );
                })}
              </div>

              {/* Admin link */}
              {(user?.role === 'ADMIN' || (user?.permissions?.length ?? 0) > 0) && (
                <NextLink
                  href="/admin"
                  onClick={onClose}
                  className="mt-4 flex items-center gap-4 rounded-2xl border border-slate-300 bg-white px-4 py-3.5 transition-colors hover:bg-slate-100 dark:border-white/10 dark:bg-white/5 dark:hover:bg-white/10"
                >
                  <LayoutDashboard className="h-5 w-5 flex-shrink-0 text-neon-gold" />
                  <span className="flex-1 font-medium">{t('adminPortal')}</span>
                  <ChevronRight className="h-4 w-4 flex-shrink-0 text-slate-400" />
                </NextLink>
              )}

              {/* Sign out */}
              {user && (
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    signOut.mutate();
                  }}
                  disabled={signOut.isPending}
                  className="mt-6 mb-4 flex w-full items-center justify-center gap-2 rounded-2xl border border-red-500/30 bg-red-500/20 px-4 py-3.5 font-medium text-red-700 transition-colors active:bg-red-500/30 dark:text-red-400"
                >
                  <LogOut className="h-5 w-5" />
                  {signOut.isPending ? nav('loggingOut') : nav('logout')}
                </button>
              )}
            </div>
          </div>
        </div>
  );
}
