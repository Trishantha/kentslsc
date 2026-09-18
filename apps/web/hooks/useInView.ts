'use client';

import { useEffect, useRef, useState } from 'react';

interface UseInViewOptions extends IntersectionObserverInit {
  /** Disconnect after the first intersection (default true). */
  once?: boolean;
}

/**
 * Minimal IntersectionObserver-based in-view hook. Replaces the
 * framer-motion whileInView pattern for scroll-triggered reveals.
 *
 * Users with prefers-reduced-motion enabled are treated as always in view,
 * so content renders without motion.
 */
export function useInView<T extends HTMLElement>(options?: UseInViewOptions) {
  const ref = useRef<T>(null);
  const [inView, setInView] = useState(false);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;

    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setInView(true);
      return;
    }

    const { once = true, ...observerOptions } = options ?? {};
    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (!entry) return;
        if (entry.isIntersecting) {
          setInView(true);
          if (once) observer.disconnect();
        } else if (!once) {
          setInView(false);
        }
      },
      { threshold: 0.1, ...observerOptions }
    );

    observer.observe(element);
    return () => observer.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { ref, inView };
}
