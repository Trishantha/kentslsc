'use client';

import dynamic from 'next/dynamic';

interface RichTextEditorProps {
  value?: string;
  onChange: (value: string) => void;
  placeholder?: string;
  minHeightClassName?: string;
}

const RichTextEditorInner = dynamic(
  () => import('./RichTextEditorInner').then((module) => module.RichTextEditorInner),
  {
    ssr: false,
    loading: () => (
      <div
        className="animate-pulse rounded-xl border border-white/10 bg-white/5"
        style={{ minHeight: 180 }}
        aria-label="Loading editor"
      />
    )
  }
);

export function RichTextEditor(props: RichTextEditorProps) {
  return <RichTextEditorInner {...props} />;
}
