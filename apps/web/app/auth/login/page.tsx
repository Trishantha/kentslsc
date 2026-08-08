'use client';

import Link from 'next/link';
import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { loginSchema, LoginInput } from '@kentslsc/shared';
import { api } from '@/lib/api';
import { isAxiosError } from 'axios';
import { AuthUser } from '@/hooks/useAuth';

export default function LoginPage() {
  return (
    <Suspense fallback={<LoginSkeleton />}>
      <LoginForm />
    </Suspense>
  );
}

function LoginSkeleton() {
  return (
    <div className="flex min-h-[80vh] items-center justify-center px-4">
      <div className="glass-card w-full max-w-md p-8">
        <h1 className="text-2xl font-bold">Welcome back</h1>
        <p className="mt-2 text-slate-700 dark:text-slate-400">Loading...</p>
      </div>
    </div>
  );
}

function LoginForm() {
  const searchParams = useSearchParams();
  const redirect = searchParams?.get('redirect') || searchParams?.get('returnTo');
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    setError
  } = useForm<LoginInput>({ resolver: zodResolver(loginSchema) });

  const onSubmit = async (data: LoginInput) => {
    try {
      await api.post('/auth/login', data);
      const { data: user } = await api.get<AuthUser>('/auth/me');
      const destination = user?.role === 'ADMIN' ? '/admin' : redirect || '/dashboard';
      window.location.href = destination;
    } catch (error) {
      if (!isAxiosError(error) || !error.response) {
        setError('root', { message: 'Cannot reach the server. Please make sure the API is running.' });
        return;
      }
      const message =
        typeof error.response.data === 'object' && 'message' in error.response.data
          ? String(error.response.data.message)
          : 'Invalid email or password';
      setError('root', { message });
    }
  };

  return (
    <div className="flex min-h-[80vh] items-center justify-center px-4">
      <div className="glass-card w-full max-w-md p-8">
        <h1 className="text-2xl font-bold">Welcome back</h1>
        <p className="mt-2 text-slate-700 dark:text-slate-400">Log in to your Kent SLSC account.</p>
        <form onSubmit={handleSubmit(onSubmit)} className="mt-6 space-y-4" suppressHydrationWarning>
          <div>
            <label className="text-sm font-medium">Email</label>
            <input {...register('email')} type="email" autoComplete="email" className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-4 py-3 outline-none dark:border-white/10 dark:bg-white/10" suppressHydrationWarning />
            {errors.email && <p className="mt-1 text-xs text-red-500">{errors.email.message}</p>}
          </div>
          <div>
            <label className="text-sm font-medium">Password</label>
            <input {...register('password')} type="password" autoComplete="current-password" className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-4 py-3 outline-none dark:border-white/10 dark:bg-white/10" suppressHydrationWarning />
            {errors.password && <p className="mt-1 text-xs text-red-500">{errors.password.message}</p>}
          </div>
          {errors.root && <p className="text-sm text-red-500">{errors.root.message}</p>}
          <button disabled={isSubmitting} className="btn-primary w-full" suppressHydrationWarning>
            {isSubmitting ? 'Logging in...' : 'Log In'}
          </button>
        </form>
        <p className="mt-4 text-center text-sm text-slate-700 dark:text-slate-400">
          Don&apos;t have an account? <Link href="/auth/register" className="text-neon-blue hover:underline">Register</Link>
        </p>
      </div>
    </div>
  );
}
