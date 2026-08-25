'use client';

import dynamic from 'next/dynamic';
import { Suspense } from 'react';

interface RichTextEditorProps {
  value?: string;
  onChange: (value: string) => void;
  placeholder?: string;
  minHeightClassName?: string;
}

const RichTextEditorInner = dynamic(
  () => import('./RichTextEditorInner').then((mod) => mod.RichTextEditorInner),
  {
    ssr: false,
    loading: () => (
      <div className="h-44 animate-pulse rounded-xl border border-white/10 bg-white/5" aria-label="Loading editor" />
    )
  }
);

export function RichTextEditor(props: RichTextEditorProps) {
  return (
    <Suspense
      fallback={
        <div className="h-44 animate-pulse rounded-xl border border-white/10 bg-white/5" aria-label="Loading editor" />
      }
    >
      <RichTextEditorInner {...props} />
    </Suspense>
  );
}
