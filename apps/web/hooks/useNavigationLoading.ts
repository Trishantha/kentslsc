'use client';

import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';

/**
 * Returns true briefly after the Next.js App Router pathname changes.
 * Useful for showing a page-transition loader on client-side navigation.
 */
export function useNavigationLoading(minDuration = 400) {
  const pathname = usePathname();
  const [currentPath, setCurrentPath] = useState(pathname);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (pathname === currentPath) return;

    setIsLoading(true);
    const timer = setTimeout(() => {
      setIsLoading(false);
      setCurrentPath(pathname);
    }, minDuration);
    return () => clearTimeout(timer);
  }, [pathname, currentPath, minDuration]);

  return isLoading;
}
