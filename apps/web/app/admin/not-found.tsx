'use client';

import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';

export default function AdminNotFound() {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center px-4 text-center">
      <h1 className="text-4xl font-bold">Not found</h1>
      <p className="mt-4 text-slate-400">
        The requested admin item could not be loaded. It may have been deleted or the URL might be incorrect.
      </p>
      <Link
        href="/admin"
        className="btn-primary mt-8 inline-flex items-center gap-2"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to admin
      </Link>
    </div>
  );
}
