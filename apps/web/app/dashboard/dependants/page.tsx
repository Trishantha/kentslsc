'use client';

import { DependantsEditor } from '@/components/dashboard/DependantsEditor';

export default function DependantsPage() {
  return (
    <div className="mx-auto max-w-5xl">
      <h1 className="section-title">Dependants</h1>
      <p className="mt-4 text-slate-700 dark:text-slate-400">
        Manage the family members covered by your membership.
      </p>

      <div className="mt-8">
        <DependantsEditor />
      </div>
    </div>
  );
}
