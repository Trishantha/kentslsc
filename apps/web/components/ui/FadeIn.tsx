'use client';

import type { ReactNode } from 'react';
import { useInView } from '@/hooks/useInView';
import { cn } from '@/lib/utils';

interface FadeInProps {
  children: ReactNode;
  className?: string;
  /** Stagger delay in seconds. */
  delay?: number;
}

/**
 * Scroll-triggered fade/slide-in reveal. Replaces framer-motion's
 * whileInView={{ opacity: 1, y: 0 }} pattern using useInView + CSS
 * transitions. Respects prefers-reduced-motion via the hook.
 */
export function FadeIn({ children, className, delay = 0 }: FadeInProps) {
  const { ref, inView } = useInView<HTMLDivElement>();

  return (
    <div
      ref={ref}
      className={cn(
        'transition-all duration-500 ease-out will-change-transform',
        inView ? 'translate-y-0 opacity-100' : 'translate-y-5 opacity-0',
        className
      )}
      style={delay ? { transitionDelay: `${delay}s` } : undefined}
    >
      {children}
    </div>
  );
}
