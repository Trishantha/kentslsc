'use client';

import { SiteLogoLoader } from '@/components/ui/SiteLogoLoader';
import { useNavigationLoading } from '@/hooks/useNavigationLoading';

interface PageTransitionLoaderProps {
  minDuration?: number;
}

export function PageTransitionLoader({ minDuration }: PageTransitionLoaderProps = {}) {
  const isLoading = useNavigationLoading(minDuration);

  if (!isLoading) return null;

  return (
    <div
      className="animate-fade-in fixed inset-0 z-[100] flex items-center justify-center bg-slate-50/90 backdrop-blur-md dark:bg-slate-950/90"
      aria-hidden="false"
      role="status"
      aria-busy="true"
      aria-label="Page loading"
    >
      <SiteLogoLoader size={120} />
    </div>
  );
}
