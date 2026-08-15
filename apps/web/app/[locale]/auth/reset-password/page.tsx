'use client';

import { useEffect, useState } from 'react';
import { Link } from '@/i18n/routing';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { passwordSchema } from '@kentslsc/shared';
import { api, getApiErrorMessage } from '@/lib/api';
import { CheckCircle2, Loader2 } from 'lucide-react';
import { useClientSearchParams } from '@/hooks/useClientSearchParams';

const formSchema = z
  .object({
    password: passwordSchema,
    confirmPassword: z.string().min(1, 'Please confirm your password')
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword']
  });

type FormValues = z.infer<typeof formSchema>;

function Wrapper({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-[80vh] items-center justify-center px-4">
      <div className="glass-card w-full max-w-md p-8">{children}</div>
    </div>
  );
}

export default function ResetPasswordPage() {
  const searchParams = useClientSearchParams();
  const [token, setToken] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (!searchParams) return;
    setToken(searchParams.get('token'));
    setReady(true);
  }, [searchParams]);

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting }
  } = useForm<FormValues>({ resolver: zodResolver(formSchema) });

  const onSubmit = async (data: FormValues) => {
    try {
      await api.post('/auth/reset-password', { token, password: data.password });
      setDone(true);
    } catch (err) {
      setError('root', { message: getApiErrorMessage(err) });
    }
  };

  if (!ready) {
    return (
      <Wrapper>
        <Loader2 className="mx-auto h-8 w-8 animate-spin text-neon-blue" />
      </Wrapper>
    );
  }

  if (!token) {
    return (
      <Wrapper>
        <h1 className="text-2xl font-bold">Link incomplete</h1>
        <p className="mt-3 text-slate-700 dark:text-slate-400">
          This reset link is missing its code. Request a new one.
        </p>
        <Link href="/auth/forgot-password" className="btn-primary mt-8 inline-block">
          Request a new link
        </Link>
      </Wrapper>
    );
  }

  if (done) {
    return (
      <Wrapper>
        <CheckCircle2 className="mx-auto h-12 w-12 text-green-500" />
        <h1 className="mt-4 text-center text-2xl font-bold">Password updated</h1>
        <p className="mt-3 text-center text-slate-700 dark:text-slate-400">
          You&rsquo;ve been signed out everywhere for security. Sign in with your new password.
        </p>
        <Link href="/auth/login" className="btn-primary mt-8 block text-center">
          Sign in
        </Link>
      </Wrapper>
    );
  }

  return (
    <Wrapper>
      <h1 className="text-2xl font-bold">Choose a new password</h1>
      <p className="mt-2 text-slate-700 dark:text-slate-400">
        At least 12 characters, with upper and lower case letters and a number.
      </p>
      <form onSubmit={handleSubmit(onSubmit)} className="mt-6 space-y-4">
        <div>
          <label className="text-sm font-medium">New password</label>
          <input
            {...register('password')}
            type="password"
            autoComplete="new-password"
            className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-4 py-3 outline-none dark:border-white/10 dark:bg-white/10"
          />
          {errors.password && <p className="mt-1 text-xs text-red-500">{errors.password.message}</p>}
        </div>
        <div>
          <label className="text-sm font-medium">Confirm new password</label>
          <input
            {...register('confirmPassword')}
            type="password"
            autoComplete="new-password"
            className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-4 py-3 outline-none dark:border-white/10 dark:bg-white/10"
          />
          {errors.confirmPassword && (
            <p className="mt-1 text-xs text-red-500">{errors.confirmPassword.message}</p>
          )}
        </div>
        {errors.root && <p className="text-sm text-red-500">{errors.root.message}</p>}
        <button disabled={isSubmitting} className="btn-primary w-full">
          {isSubmitting ? 'Updating…' : 'Update password'}
        </button>
      </form>
    </Wrapper>
  );
}
