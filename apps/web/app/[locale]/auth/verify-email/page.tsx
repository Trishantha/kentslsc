'use client';

import { useEffect, useRef, useState } from 'react';
import { api, getApiErrorMessage } from '@/lib/api';
import { CheckCircle2, XCircle, Loader2 } from 'lucide-react';
import { useClientSearchParams } from '@/hooks/useClientSearchParams';

/**
 * Landing page for the link in the confirmation email.
 *
 * Public and locale-prefixed: the link may be opened in a different browser (or
 * on a phone) from the one that registered, so it must work signed-out.
 */
function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-[70vh] items-center justify-center px-4 py-12">
      <div className="glass-card w-full max-w-lg p-8 text-center">{children}</div>
    </div>
  );
}

export default function VerifyEmailPage() {
  const searchParams = useClientSearchParams();
  const [token, setToken] = useState<string | null>(null);
  const [state, setState] = useState<'verifying' | 'success' | 'error'>('verifying');
  const [message, setMessage] = useState<string | null>(null);
  // React 18 StrictMode double-invokes effects in dev; without this the
  // single-use token is consumed twice and the second call renders an error.
  const attempted = useRef(false);

  useEffect(() => {
    if (!searchParams) return;

    const t = searchParams.get('token');
    setToken(t);

    if (attempted.current) return;
    attempted.current = true;

    if (!t) {
      setState('error');
      setMessage('This link is missing its confirmation code.');
      return;
    }

    api
      .post('/auth/verify-email', { token: t })
      .then(() => setState('success'))
      .catch((err) => {
        setState('error');
        setMessage(getApiErrorMessage(err));
      });
  }, [searchParams]);

  if (state === 'verifying') {
    return (
      <Shell>
        <Loader2 className="mx-auto h-8 w-8 animate-spin text-neon-blue" />
        <p className="mt-4 text-slate-700 dark:text-slate-400">Confirming your email address…</p>
      </Shell>
    );
  }

  if (state === 'success') {
    return (
      <Shell>
        <CheckCircle2 className="mx-auto h-12 w-12 text-green-500" />
        <h1 className="mt-4 text-2xl font-bold">Email confirmed</h1>
        <p className="mt-3 text-slate-700 dark:text-slate-400">
          Your account is fully activated. You can now sign in and use the whole portal.
        </p>
        <a href="/dashboard" className="btn-primary mt-8 inline-block">
          Go to my dashboard
        </a>
      </Shell>
    );
  }

  return (
    <Shell>
      <XCircle className="mx-auto h-12 w-12 text-red-500" />
      <h1 className="mt-4 text-2xl font-bold">We couldn&rsquo;t confirm that link</h1>
      <p className="mt-3 text-slate-700 dark:text-slate-400">
        {message ?? 'This confirmation link is invalid or has expired.'}
      </p>
      <p className="mt-2 text-sm text-slate-600 dark:text-slate-500">
        Sign in and use &ldquo;Resend the link&rdquo; to get a fresh one.
      </p>
      <a href="/auth/login" className="btn-primary mt-8 inline-block">
        Sign in
      </a>
    </Shell>
  );
}
