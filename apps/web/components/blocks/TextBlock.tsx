'use client';

import type { TextBlock } from '@kentslsc/shared';
import { FadeIn } from '@/components/ui/FadeIn';

interface Props {
  block: TextBlock;
}

export default function TextBlockComponent({ block }: Props) {
  const { title, content, align = 'left' } = block;

  const alignment = {
    left: 'text-left',
    center: 'text-center',
    right: 'text-right'
  }[align];

  return (
    <section className="px-4 py-16 md:px-6">
      <FadeIn className={`mx-auto max-w-4xl ${alignment}`}>
        {title && <h2 className="section-title">{title}</h2>}
        {content && (
          <div className="mt-6 whitespace-pre-wrap text-slate-700 dark:text-slate-300">
            {content}
          </div>
        )}
      </FadeIn>
    </section>
  );
}
