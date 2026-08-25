'use client';

import { useEffect, useState } from 'react';
import { RichTextEditorInner } from './RichTextEditorInner';

interface RichTextEditorProps {
  value?: string;
  onChange: (value: string) => void;
  placeholder?: string;
  minHeightClassName?: string;
}

export function RichTextEditor(props: RichTextEditorProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <div
        className="animate-pulse rounded-xl border border-white/10 bg-white/5"
        style={{ minHeight: props.minHeightClassName?.match(/\d+/)?.[0] ? `${props.minHeightClassName.match(/\d+/)?.[0]}px` : '180px' }}
        aria-label="Loading editor"
      />
    );
  }

  return <RichTextEditorInner {...props} />;
}
