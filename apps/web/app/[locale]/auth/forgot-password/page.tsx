'use client';

import { useState } from 'react';
import { Link } from '@/i18n/routing';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { forgotPasswordSchema, type ForgotPasswordInput } from '@kentslsc/shared';
import { api } from '@/lib/api';
import { MailCheck } from 'lucide-react';

export default function ForgotPasswordPage() {
  const [sent, setSent] = useState(false);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting }
  } = useForm<ForgotPasswordInput>({ resolver: zodResolver(forgotPasswordSchema) });

  const onSubmit = async (data: ForgotPasswordInput) => {
    // The API always answers 202 whether or not the account exists, so there is
    // no error branch to distinguish here — that is the point.
    await api.post('/auth/forgot-password', data).catch(() => undefined);
    setSent(true);
  };

  if (sent) {
    return (
      <div className="flex min-h-[80vh] items-center justify-center px-4">
        <div className="glass-card w-full max-w-md p-8 text-center">
          <MailCheck className="mx-auto h-12 w-12 text-neon-blue" />
          <h1 className="mt-4 text-2xl font-bold">Check your inbox</h1>
          <p className="mt-3 text-slate-700 dark:text-slate-400">
            If that email address has an account, a reset link is on its way. The link expires in an
            hour.
          </p>
          <Link href="/auth/login" className="btn-primary mt-8 inline-block">
            Back to sign in
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-[80vh] items-center justify-center px-4">
      <div className="glass-card w-full max-w-md p-8">
        <h1 className="text-2xl font-bold">Forgot your password?</h1>
        <p className="mt-2 text-slate-700 dark:text-slate-400">
          Enter your email address and we&rsquo;ll send you a link to choose a new one.
        </p>
        <form onSubmit={handleSubmit(onSubmit)} className="mt-6 space-y-4">
          <div>
            <label className="text-sm font-medium">Email</label>
            <input
              {...register('email')}
              type="email"
              autoComplete="email"
              className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-4 py-3 outline-none dark:border-white/10 dark:bg-white/10"
            />
            {errors.email && <p className="mt-1 text-xs text-red-500">{errors.email.message}</p>}
          </div>
          <button disabled={isSubmitting} className="btn-primary w-full">
            {isSubmitting ? 'Sending…' : 'Send reset link'}
          </button>
        </form>
        <p className="mt-4 text-center text-sm text-slate-700 dark:text-slate-400">
          <Link href="/auth/login" className="text-neon-blue hover:underline">
            Back to sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
