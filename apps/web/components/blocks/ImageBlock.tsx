'use client';

import { motion } from 'framer-motion';
import type { ImageBlock } from '@kentslsc/shared';

interface Props {
  block: ImageBlock;
}

export default function ImageBlockComponent({ block }: Props) {
  const { imageUrl, alt, caption } = block;

  if (!imageUrl) return null;

  return (
    <section className="px-4 py-8 md:px-6">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        className="mx-auto max-w-5xl"
      >
        <div className="glass-card overflow-hidden p-0">
          <img src={imageUrl} alt={alt || ''} className="h-auto w-full object-contain" />
        </div>
        {caption && (
          <p className="mt-3 text-center text-sm text-slate-500">{caption}</p>
        )}
      </motion.div>
    </section>
  );
}
