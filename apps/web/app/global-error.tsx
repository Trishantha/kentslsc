'use client';

import { useEffect } from 'react';

export default function GlobalError({
  error,
  reset
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log to your error tracking service here (e.g. Sentry)
    // eslint-disable-next-line no-console
    console.error('Global error:', error);
  }, [error]);

  return (
    <html lang="en">
      <body className="flex min-h-screen flex-col items-center justify-center bg-slate-950 px-4 text-center text-slate-100">
        <div className="mx-auto max-w-md">
          <h1 className="text-4xl font-bold">Something went wrong</h1>
          <p className="mt-4 text-slate-400">
            We&apos;re sorry, but the page failed to load. Please try again or contact us if the
            problem persists.
          </p>
          <button
            onClick={reset}
            className="mt-8 inline-flex items-center justify-center rounded-xl bg-gradient-to-r from-neon-blue to-emerald-600 px-6 py-3 font-semibold text-white shadow-neon transition-transform hover:scale-105 active:scale-95"
          >
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}
