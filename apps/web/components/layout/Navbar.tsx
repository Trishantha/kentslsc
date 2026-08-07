'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Menu, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { ThemeToggle } from '@/components/ui/ThemeToggle';
import { FeatureGate } from '@/components/ui/FeatureGate';
import { MembershipFeature } from '@kentslsc/shared';
import { cn } from '@/lib/utils';

const publicNavLinks = [
  { href: '/', label: 'Home' },
  { href: '/events', label: 'Events' },
  { href: '/directory', label: 'Directory' },
  { href: '/fundraisers', label: 'Fundraising' },
  { href: '/blog', label: 'Blog' },
  { href: '/about', label: 'About' },
  { href: '/contact', label: 'Contact' }
];

const memberNavLinks = [
  { href: '/forum', label: 'Forum', feature: MembershipFeature.FORUM_READ },
  { href: '/membership', label: 'Membership', feature: null }
];

export function Navbar() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const pathname = usePathname();
  const isAdmin = pathname.startsWith('/admin');
  const compact = scrolled || isAdmin;

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 10);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <>
      {!isAdmin && <div className="h-14" />}
      <header
        className={cn(
          'sticky z-50 glass overflow-visible border-b-0 transition-all duration-300',
          compact ? 'top-0' : 'top-14'
        )}
      >
        <nav className="mx-auto flex h-[68px] max-w-7xl items-center justify-between overflow-visible px-4 md:px-6">
          <Link href="/" className="relative flex items-center gap-3">
            <span className="relative flex h-11 w-11 items-center justify-start overflow-visible">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/logo.png"
                alt="Kent Sri Lankan Social Club logo"
                className={cn(
                  'max-w-none rounded-full object-contain transition-all duration-300',
                  compact ? 'h-11 w-11' : 'h-32 w-32 md:h-36 md:w-36'
                )}
              />
            </span>
            <span
              className={cn(
                'whitespace-nowrap text-xl font-extrabold tracking-tight gradient-text transition-all duration-300',
                compact ? 'pl-0' : 'pl-20 md:pl-24'
              )}
            >
              KENT SLSC
            </span>
          </Link>

        <div className="hidden items-center gap-6 md:flex">
          {publicNavLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="text-sm font-medium text-slate-700 transition-colors hover:text-neon-blue dark:text-slate-300"
            >
              {link.label}
            </Link>
          ))}
          {memberNavLinks.map((link) =>
            link.feature ? (
              <FeatureGate key={link.href} feature={link.feature}>
                <Link
                  href={link.href}
                  className="text-sm font-medium text-slate-700 transition-colors hover:text-neon-blue dark:text-slate-300"
                >
                  {link.label}
                </Link>
              </FeatureGate>
            ) : (
              <Link
                key={link.href}
                href={link.href}
                className="text-sm font-medium text-slate-700 transition-colors hover:text-neon-blue dark:text-slate-300"
              >
                {link.label}
              </Link>
            )
          )}
          <FeatureGate
            feature={MembershipFeature.DASHBOARD_ACCESS}
            fallback={
              <Link
                href="/auth/register"
                className="rounded-xl border border-neon-gold/50 px-4 py-2 text-sm font-semibold text-amber-700 transition-transform hover:scale-105 dark:text-neon-gold"
              >
                Join
              </Link>
            }
          >
            <Link href="/dashboard" className="btn-primary px-4 py-2 text-sm">
              Dashboard
            </Link>
          </FeatureGate>
          <ThemeToggle />
        </div>

        <div className="flex items-center gap-2 md:hidden">
          <ThemeToggle />
          <button
            onClick={() => setMobileOpen(!mobileOpen)}
            className="rounded-lg p-2 hover:bg-white/10 dark:hover:bg-black/30"
          >
            {mobileOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
          </button>
        </div>
      </nav>

      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="glass border-t border-white/10 md:hidden"
          >
            <div className="flex flex-col gap-4 px-4 py-6">
              {publicNavLinks.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  onClick={() => setMobileOpen(false)}
                  className="text-lg font-medium text-slate-800 dark:text-slate-200"
                >
                  {link.label}
                </Link>
              ))}
              {memberNavLinks.map((link) =>
                link.feature ? (
                  <FeatureGate key={link.href} feature={link.feature}>
                    <Link
                      href={link.href}
                      onClick={() => setMobileOpen(false)}
                      className="text-lg font-medium text-slate-800 dark:text-slate-200"
                    >
                      {link.label}
                    </Link>
                  </FeatureGate>
                ) : (
                  <Link
                    key={link.href}
                    href={link.href}
                    onClick={() => setMobileOpen(false)}
                    className="text-lg font-medium text-slate-800 dark:text-slate-200"
                  >
                    {link.label}
                  </Link>
                )
              )}
              <FeatureGate
                feature={MembershipFeature.DASHBOARD_ACCESS}
                fallback={
                  <Link
                    href="/auth/register"
                    onClick={() => setMobileOpen(false)}
                    className="mt-2 rounded-xl border border-neon-gold/50 px-4 py-3 text-center font-semibold text-amber-700 dark:text-neon-gold"
                  >
                    Join
                  </Link>
                }
              >
                <Link
                  href="/dashboard"
                  onClick={() => setMobileOpen(false)}
                  className="btn-primary mt-2 text-center"
                >
                  Dashboard
                </Link>
              </FeatureGate>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      </header>
    </>
  );
}
