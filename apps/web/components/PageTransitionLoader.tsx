'use client';

import { AnimatePresence, motion } from 'framer-motion';
import { SiteLogoLoader } from '@/components/ui/SiteLogoLoader';
import { useNavigationLoading } from '@/hooks/useNavigationLoading';

export function PageTransitionLoader() {
  const isLoading = useNavigationLoading();

  return (
    <AnimatePresence>
      {isLoading && (
        <motion.div
          key="page-loader"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-50/90 backdrop-blur-md dark:bg-slate-950/90"
          aria-hidden="false"
          role="status"
          aria-busy="true"
          aria-label="Page loading"
        >
          <SiteLogoLoader size={120} />
        </motion.div>
      )}
    </AnimatePresence>
  );
}
