'use client';

import { useState } from 'react';
import { useAuth, useSignOut } from '@/hooks/useAuth';
import { api, getApiErrorMessage } from '@/lib/api';
import { Loader2, MailCheck, RefreshCw, LogOut } from 'lucide-react';

/**
 * The gate an unverified user lands on. Lives outside [locale] to match the
 * other portal areas (/dashboard, /forum, /admin), which are English-only.
 */
export default function VerifyEmailPage() {
  const { data: user } = useAuth();
  const signOut = useSignOut();
  const [status, setStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');
  const [error, setError] = useState<string | null>(null);

  const resend = async () => {
    setStatus('sending');
    setError(null);
    try {
      await api.post('/auth/resend-verification');
      setStatus('sent');
    } catch (err) {
      setError(getApiErrorMessage(err));
      setStatus('error');
    }
  };

  return (
    <div className="flex min-h-[70vh] items-center justify-center px-4 py-12">
      <div className="glass-card w-full max-w-lg p-8 text-center">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-neon-blue/10">
          <MailCheck className="h-7 w-7 text-neon-blue" />
        </div>

        <h1 className="mt-6 text-2xl font-bold">Confirm your email address</h1>
        <p className="mt-3 text-slate-700 dark:text-slate-400">
          We&rsquo;ve sent a confirmation link to{' '}
          <span className="font-medium text-slate-900 dark:text-white">{user?.email}</span>. Open it
          to unlock the full member portal.
        </p>
        <p className="mt-2 text-sm text-slate-600 dark:text-slate-500">
          You can still view and update your profile in the meantime. Check your spam folder if it
          hasn&rsquo;t arrived within a few minutes.
        </p>

        {status === 'sent' && (
          <p className="mt-6 rounded-lg bg-green-500/10 px-4 py-3 text-sm text-green-600 dark:text-green-400">
            A new confirmation link is on its way.
          </p>
        )}
        {status === 'error' && error && (
          <p className="mt-6 rounded-lg bg-red-500/10 px-4 py-3 text-sm text-red-500">{error}</p>
        )}

        <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center">
          <button
            type="button"
            onClick={resend}
            disabled={status === 'sending'}
            className="btn-primary inline-flex items-center justify-center gap-2"
          >
            {status === 'sending' ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4" />
            )}
            Resend the link
          </button>
          <button
            type="button"
            onClick={() => signOut.mutate()}
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-300 px-5 py-3 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-100 dark:border-white/10 dark:text-slate-300 dark:hover:bg-white/5"
          >
            <LogOut className="h-4 w-4" />
            Sign out
          </button>
        </div>
      </div>
    </div>
  );
}
