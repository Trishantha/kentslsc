'use client';

import { Link } from '@/i18n/routing';
import { useTranslations } from 'next-intl';
import { useSiteSettings } from '@/hooks/useSiteSettings';
import { SocialLinks } from './SocialLinks';
import { Loader2 } from 'lucide-react';

export function Footer() {
  const t = useTranslations('footer');
  const nav = useTranslations('nav');
  const { data: settings, isLoading } = useSiteSettings();

  const email = settings?.email || t('email');
  const phone = settings?.phone || null;
  const address = settings?.address || t('location');

  return (
    <footer className="border-t border-slate-300 bg-slate-200 py-12 pb-[calc(64px+env(safe-area-inset-bottom))] dark:border-white/10 dark:bg-slate-950 md:pb-12">
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
              <li><Link href="/privacy-policy">Privacy Policy</Link></li>
              <li><Link href="/terms-and-conditions">Terms &amp; Conditions</Link></li>
              <li><Link href="/cookie-policy">Cookie Policy</Link></li>
              <li><Link href="/gdpr">GDPR</Link></li>
            </ul>
          </div>
          <div>
            <h4 className="font-semibold">{t('contact')}</h4>
            {isLoading ? (
              <div className="mt-2 flex h-20 items-center justify-center">
                <Loader2 className="h-5 w-5 animate-spin text-slate-400" />
              </div>
            ) : (
              <div className="mt-2 space-y-1 text-sm text-slate-700 dark:text-slate-400">
                <p>
                  <a href={`mailto:${email}`} className="hover:text-neon-blue">{email}</a>
                </p>
                {phone && (
                  <p>
                    <a href={`tel:${phone.replace(/\s/g, '')}`} className="hover:text-neon-blue">{phone}</a>
                  </p>
                )}
                <p>{address}</p>
              </div>
            )}
            <SocialLinks
              links={settings || {}}
              className="mt-4 flex flex-wrap gap-3"
            />
          </div>
        </div>
        <div className="mt-8 border-t border-slate-300 pt-6 text-center text-xs text-slate-600 dark:border-white/10 dark:text-slate-400">
          {t('copyright', { year: new Date().getFullYear() })}
        </div>
      </div>
    </footer>
  );
}
