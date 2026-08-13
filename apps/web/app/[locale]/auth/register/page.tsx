'use client';

import { Suspense } from 'react';
import { Link } from '@/i18n/routing';
import { useTranslations } from 'next-intl';
import { RegistrationWizard } from '@/components/auth/RegistrationWizard';

function RegisterPageContent() {
  const t = useTranslations('auth');

  return (
    <div className="min-h-[80vh] px-4 py-12 md:py-16">
      <div className="mx-auto max-w-5xl">
        <div className="mb-8 text-center">
          <h1 className="text-2xl font-bold md:text-3xl">{t('becomeMember')}</h1>
          <p className="mt-2 text-slate-700 dark:text-slate-400">
            {t('registerIntro')}
          </p>
        </div>

        <RegistrationWizard />

        <p className="mt-8 text-center text-sm text-slate-700 dark:text-slate-400">
          {t('alreadyHaveAccount')}{' '}
          <Link href="/auth/login" className="text-neon-blue hover:underline">
            {t('logIn')}
          </Link>
        </p>
      </div>
    </div>
  );
}

export default function RegisterPage() {
  return (
    <Suspense fallback={<div className="min-h-[80vh]" />}>
      <RegisterPageContent />
    </Suspense>
  );
}
