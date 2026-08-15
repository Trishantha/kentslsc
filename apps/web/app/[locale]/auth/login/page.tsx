'use client';

import { Link } from '@/i18n/routing';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useTranslations } from 'next-intl';
import { loginSchema, LoginInput } from '@kentslsc/shared';
import { api } from '@/lib/api';
import { isAxiosError } from 'axios';
import { safeRedirect } from '@/lib/safe-redirect';

export default function LoginPage() {
  const t = useTranslations('auth');
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    setError
  } = useForm<LoginInput>({ resolver: zodResolver(loginSchema) });

  const onSubmit = async (data: LoginInput) => {
    try {
      const { data: result } = await api.post('/auth/login', data);

      // Read the redirect param at submit time to avoid useSearchParams/Suspense,
      // which can leave the form stuck on "Loading..." in static builds.
      // Both params are attacker-controllable; safeRedirect collapses anything
      // off-origin (or looping back into /auth) to the dashboard.
      const searchParams =
        typeof window !== 'undefined'
          ? new URLSearchParams(window.location.search)
          : new URLSearchParams();
      const redirect = safeRedirect(
        searchParams.get('redirect') ?? searchParams.get('returnTo')
      );

      // Unverified users may sign in, but land on the verification gate rather
      // than a portal page they'd immediately be bounced out of.
      let destination = redirect;
      if (!result?.emailVerified) {
        destination = '/verify-email';
      } else if (result?.role === 'ADMIN' && redirect === '/dashboard') {
        destination = '/admin';
      }

      // Use a full page navigation so the new session cookies are sent on the
      // first request to the destination, rather than relying on a client-side
      // transition that may skip the server-side auth check.
      window.location.href = destination;
    } catch (error) {
      if (!isAxiosError(error) || !error.response) {
        setError('root', { message: t('cannotReachServer') });
        return;
      }
      const message =
        typeof error.response.data === 'object' && 'message' in error.response.data
          ? String(error.response.data.message)
          : t('invalidCredentials');
      setError('root', { message });
    }
  };

  return (
    <div className="flex min-h-[80vh] items-center justify-center px-4">
      <div className="glass-card w-full max-w-md p-8">
        <h1 className="text-2xl font-bold">{t('welcomeBack')}</h1>
        <p className="mt-2 text-slate-700 dark:text-slate-400">{t('loginToAccount')}</p>
        <form onSubmit={handleSubmit(onSubmit)} noValidate className="mt-6 space-y-4" suppressHydrationWarning>
          <div>
            <label className="text-sm font-medium">{t('email')}</label>
            <input {...register('email')} type="email" autoComplete="email" className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-4 py-3 outline-none dark:border-white/10 dark:bg-white/10" suppressHydrationWarning />
            {errors.email && <p className="mt-1 text-xs text-red-500">{errors.email.message}</p>}
          </div>
          <div>
            <label className="text-sm font-medium">{t('password')}</label>
            <input {...register('password')} type="password" autoComplete="current-password" className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-4 py-3 outline-none dark:border-white/10 dark:bg-white/10" suppressHydrationWarning />
            {errors.password && <p className="mt-1 text-xs text-red-500">{errors.password.message}</p>}
          </div>
          {errors.root && <p className="text-sm text-red-500">{errors.root.message}</p>}
          <button type="submit" disabled={isSubmitting} className="btn-primary w-full disabled:opacity-70 disabled:cursor-not-allowed" suppressHydrationWarning>
            {isSubmitting ? t('loggingIn') : t('logIn')}
          </button>
        </form>
        <p className="mt-3 text-center text-sm">
          <Link href="/auth/forgot-password" className="text-neon-blue hover:underline">
            {t('forgotPassword')}
          </Link>
        </p>
        <p className="mt-4 text-center text-sm text-slate-700 dark:text-slate-400">
          {t('noAccount')} <Link href="/auth/register" className="text-neon-blue hover:underline">{t('register')}</Link>
        </p>
      </div>
    </div>
  );
}
