'use client';

import { motion } from 'framer-motion';
import type { TextBlock } from '@kentslsc/shared';

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
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        className={`mx-auto max-w-4xl ${alignment}`}
      >
        {title && <h2 className="section-title">{title}</h2>}
        {content && (
          <div className="mt-6 whitespace-pre-wrap text-slate-600 dark:text-slate-300">
            {content}
          </div>
        )}
      </motion.div>
    </section>
  );
}
