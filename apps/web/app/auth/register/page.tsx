'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { registerSchema, RegisterInput } from '@kentslsc/shared';
import { api } from '@/lib/api';
import { isAxiosError } from 'axios';

export default function RegisterPage() {
  const router = useRouter();
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    setError
  } = useForm<RegisterInput>({ resolver: zodResolver(registerSchema) });

  const onSubmit = async (data: RegisterInput) => {
    try {
      await api.post('/auth/register', data);
      router.push('/dashboard');
    } catch (error) {
      if (!isAxiosError(error) || !error.response) {
        setError('root', { message: 'Cannot reach the server. Please make sure the API is running.' });
        return;
      }
      const message =
        typeof error.response.data === 'object' && 'message' in error.response.data
          ? String(error.response.data.message)
          : 'Registration failed. Email may already be in use.';
      setError('root', { message });
    }
  };

  return (
    <div className="flex min-h-[80vh] items-center justify-center px-4">
      <div className="glass-card w-full max-w-md p-8">
        <h1 className="text-2xl font-bold">Create an account</h1>
        <p className="mt-2 text-slate-600 dark:text-slate-400">Join the Kent SLSC community.</p>
        <form onSubmit={handleSubmit(onSubmit)} className="mt-6 space-y-4">
          <div>
            <label className="text-sm font-medium">Full Name</label>
            <input {...register('name')} autoComplete="name" className="mt-1 w-full rounded-lg border border-white/10 bg-white/10 px-4 py-3 outline-none" suppressHydrationWarning />
            {errors.name && <p className="mt-1 text-xs text-red-500">{errors.name.message}</p>}
          </div>
          <div>
            <label className="text-sm font-medium">Email</label>
            <input {...register('email')} type="email" autoComplete="email" className="mt-1 w-full rounded-lg border border-white/10 bg-white/10 px-4 py-3 outline-none" suppressHydrationWarning />
            {errors.email && <p className="mt-1 text-xs text-red-500">{errors.email.message}</p>}
          </div>
          <div>
            <label className="text-sm font-medium">Password</label>
            <input {...register('password')} type="password" autoComplete="new-password" className="mt-1 w-full rounded-lg border border-white/10 bg-white/10 px-4 py-3 outline-none" suppressHydrationWarning />
            {errors.password && <p className="mt-1 text-xs text-red-500">{errors.password.message}</p>}
          </div>
          <div>
            <label className="text-sm font-medium">Phone (optional)</label>
            <input {...register('phone')} autoComplete="tel" className="mt-1 w-full rounded-lg border border-white/10 bg-white/10 px-4 py-3 outline-none" suppressHydrationWarning />
          </div>
          <div>
            <label className="text-sm font-medium">Address (optional)</label>
            <input {...register('address')} autoComplete="street-address" className="mt-1 w-full rounded-lg border border-white/10 bg-white/10 px-4 py-3 outline-none" suppressHydrationWarning />
          </div>
          {errors.root && <p className="text-sm text-red-500">{errors.root.message}</p>}
          <button disabled={isSubmitting} className="btn-primary w-full" suppressHydrationWarning>
            {isSubmitting ? 'Registering...' : 'Register'}
          </button>
        </form>
        <p className="mt-4 text-center text-sm text-slate-600 dark:text-slate-400">
          Already have an account? <Link href="/auth/login" className="text-neon-blue hover:underline">Log in</Link>
        </p>
      </div>
    </div>
  );
}
