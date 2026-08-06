'use client';

import Link from 'next/link';
import { motion } from 'framer-motion';
import type { CtaBlock } from '@kentslsc/shared';

interface Props {
  block: CtaBlock;
}

export default function CtaBlockComponent({ block }: Props) {
  const { title, content, buttonText, buttonUrl } = block;

  return (
    <section className="px-4 py-16 md:px-6">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        className="mx-auto max-w-4xl rounded-3xl bg-gradient-to-r from-neon-blue/20 to-neon-gold/20 p-8 text-center md:p-12"
      >
        {title && <h2 className="text-3xl font-bold md:text-4xl">{title}</h2>}
        {content && <p className="mx-auto mt-4 max-w-2xl text-slate-700 dark:text-slate-300">{content}</p>}
        {buttonText && buttonUrl && (
          <div className="mt-8">
            <Link href={buttonUrl} className="btn-primary">
              {buttonText}
            </Link>
          </div>
        )}
      </motion.div>
    </section>
  );
}
