'use client';

import { NextIntlClientProvider, useTranslations } from 'next-intl';
import { Link } from '@/i18n/routing';
import enMessages from '../messages/en.json';

function NotFoundInner() {
  const t = useTranslations('notFound');

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center px-4 text-center">
      <h1 className="text-4xl font-bold">{t('title')}</h1>
      <p className="mt-4 text-lg text-slate-600 dark:text-slate-400">{t('description')}</p>
      <Link href="/" className="btn-primary mt-8">
        {t('goHome')}
      </Link>
    </div>
  );
}

export default function NotFound() {
  return (
    <NextIntlClientProvider locale="en" messages={enMessages}>
      <NotFoundInner />
    </NextIntlClientProvider>
  );
}
