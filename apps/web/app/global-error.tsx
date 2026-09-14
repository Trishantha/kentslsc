'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { NextIntlClientProvider, useTranslations } from 'next-intl';
import enMessages from '../messages/en.json';
import siMessages from '../messages/si.json';
import taMessages from '../messages/ta.json';

const LOCALES = ['en', 'si', 'ta'] as const;
type SupportedLocale = (typeof LOCALES)[number];

const MESSAGES = {
  en: enMessages,
  si: siMessages,
  ta: taMessages
} as const satisfies Record<SupportedLocale, typeof enMessages>;

function getLocaleFromPath(pathname: string): SupportedLocale {
  const segment = pathname.split('/').filter(Boolean)[0];
  return LOCALES.includes(segment as SupportedLocale) ? (segment as SupportedLocale) : 'en';
}

function GlobalErrorInner({
  error,
  reset
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const t = useTranslations('globalError');

  useEffect(() => {
    // Log to your error tracking service here (e.g. Sentry)

    console.error('Global error:', error);
  }, [error]);

  return (
    <html lang="en">
      <body className="flex min-h-screen flex-col items-center justify-center bg-slate-950 px-4 text-center text-slate-100">
        <div className="mx-auto max-w-md">
          <h1 className="text-4xl font-bold">{t('title')}</h1>
          <p className="mt-4 text-slate-400">{t('description')}</p>
          <button
            onClick={reset}
            className="mt-8 inline-flex items-center justify-center rounded-xl bg-gradient-to-r from-neon-blue to-emerald-600 px-6 py-3 font-semibold text-white shadow-neon transition-transform hover:scale-105 active:scale-95"
          >
            {t('tryAgain')}
          </button>
        </div>
      </body>
    </html>
  );
}

export default function GlobalError({
  error,
  reset
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const pathname = usePathname();
  const locale = getLocaleFromPath(pathname ?? '/en');

  return (
    <NextIntlClientProvider locale={locale} messages={MESSAGES[locale]}>
      <GlobalErrorInner error={error} reset={reset} />
    </NextIntlClientProvider>
  );
}
