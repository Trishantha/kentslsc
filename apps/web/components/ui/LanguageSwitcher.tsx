'use client';

import { useState, useRef, useEffect } from 'react';
import { usePathname, useRouter } from '@/i18n/routing';
import { useLocale } from 'next-intl';
import { Globe, Check } from 'lucide-react';
import { cn } from '@/lib/utils';

const locales = [
  { code: 'en', label: 'English', native: 'English' },
  { code: 'si', label: 'Sinhala', native: 'සිංහල' },
  { code: 'ta', label: 'Tamil', native: 'தமிழ்' }
] as const;

export function LanguageSwitcher({ className }: { className?: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const currentLocale = useLocale();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div ref={ref} className={cn('relative', className)}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-1 rounded-md px-2 py-1.5 text-xs font-semibold uppercase tracking-wide transition-colors hover:bg-slate-200 dark:hover:bg-white/10"
        aria-label="Change language"
        aria-expanded={open}
      >
        <Globe className="h-3.5 w-3.5" />
        <span>{currentLocale}</span>
      </button>

      {open && (
        <div className="absolute right-0 z-50 mt-2 w-40 rounded-xl border border-slate-200 bg-white py-1 shadow-lg dark:border-white/10 dark:bg-slate-900">
          {locales.map((locale) => (
            <button
              key={locale.code}
              type="button"
              onClick={() => {
                router.replace(pathname, { locale: locale.code });
                setOpen(false);
              }}
              className="flex w-full items-center justify-between px-4 py-2 text-left text-sm transition-colors hover:bg-slate-100 dark:hover:bg-white/10"
            >
              <span>
                <span className="font-medium">{locale.native}</span>
                <span className="ml-2 text-xs text-slate-500">{locale.label}</span>
              </span>
              {currentLocale === locale.code && <Check className="h-4 w-4 text-neon-blue" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
