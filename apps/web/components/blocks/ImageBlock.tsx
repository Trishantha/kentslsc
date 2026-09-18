'use client';

import Image from 'next/image';
import type { ImageBlock } from '@kentslsc/shared';
import { FadeIn } from '@/components/ui/FadeIn';

interface Props {
  block: ImageBlock;
}

export default function ImageBlockComponent({ block }: Props) {
  const { imageUrl, alt, caption } = block;

  if (!imageUrl) return null;

  return (
    <section className="px-4 py-8 md:px-6">
      <FadeIn className="mx-auto max-w-5xl">
        <div className="glass-card overflow-hidden p-0">
          <div className="relative aspect-video w-full">
            <Image
              src={imageUrl}
              alt={alt || ''}
              fill
              sizes="(max-width: 64rem) 100vw, 64rem"
              className="object-contain"
            />
          </div>
        </div>
        {caption && (
          <p className="mt-3 text-center text-sm text-slate-500">{caption}</p>
        )}
      </FadeIn>
    </section>
  );
}
