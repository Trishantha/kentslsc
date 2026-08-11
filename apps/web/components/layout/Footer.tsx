'use client';

import { Link } from '@/i18n/routing';
import { useTranslations } from 'next-intl';

export function Footer() {
  const t = useTranslations('footer');
  const nav = useTranslations('nav');

  return (
    <footer className="border-t border-slate-300 bg-slate-200 py-12 dark:border-white/10 dark:bg-slate-950">
      <div className="mx-auto max-w-7xl px-4 md:px-6">
        <div className="grid gap-8 md:grid-cols-3">
          <div>
            <h3 className="text-lg font-bold gradient-text">{t('title')}</h3>
            <p className="mt-2 text-sm text-slate-700 dark:text-slate-400">
              {t('tagline')}
            </p>
          </div>
          <div>
            <h4 className="font-semibold">{t('quickLinks')}</h4>
            <ul className="mt-2 space-y-1 text-sm text-slate-700 dark:text-slate-400">
              <li><Link href="/events">{nav('events')}</Link></li>
              <li><Link href="/directory">{nav('directory')}</Link></li>
              <li><Link href="/membership">{nav('membership')}</Link></li>
              <li><Link href="/contact">{nav('contact')}</Link></li>
              <li><Link href="/privacy">{nav('privacy')}</Link></li>
            </ul>
          </div>
          <div>
            <h4 className="font-semibold">{t('contact')}</h4>
            <p className="mt-2 text-sm text-slate-700 dark:text-slate-400">
              {t('email')}<br />
              {t('location')}
            </p>
          </div>
        </div>
        <div className="mt-8 border-t border-slate-300 pt-6 text-center text-xs text-slate-600 dark:border-white/10 dark:text-slate-400">
          {t('copyright', { year: new Date().getFullYear() })}
        </div>
      </div>
    </footer>
  );
}
