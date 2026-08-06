'use client';

import dynamic from 'next/dynamic';

const PageEditor = dynamic(() => import('@/components/admin/PageEditor'), { ssr: false });

export default function NewPage() {
  return (
    <div>
      <h1 className="section-title">Create page</h1>
      <div className="mt-6">
        <PageEditor />
      </div>
    </div>
  );
}
