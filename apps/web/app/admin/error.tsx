'use client';

import { useEffect } from 'react';
import { ArrowLeft, RotateCcw } from 'lucide-react';
import Link from 'next/link';

export default function AdminError({
  error,
  reset
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // eslint-disable-next-line no-console
    console.error('Admin error boundary caught:', error);
  }, [error]);

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center px-4 text-center">
      <h1 className="text-4xl font-bold">Something went wrong</h1>
      <p className="mt-4 max-w-lg text-slate-400">
        The admin page failed to load. If this persists, check the server logs for the
        error digest {error.digest ? `(${error.digest})` : ''}.
      </p>
      <div className="mt-8 flex gap-3">
        <button
          type="button"
          onClick={reset}
          className="btn-primary inline-flex items-center gap-2"
        >
          <RotateCcw className="h-4 w-4" />
          Try again
        </button>
        <Link
          href="/admin"
          className="btn-secondary inline-flex items-center gap-2"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to admin
        </Link>
      </div>
    </div>
  );
}
