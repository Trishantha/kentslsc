'use client';

import { useEffect } from 'react';

const CHUNK_ERROR_PATTERN = /(ChunkLoadError|Loading chunk \d+ failed)/i;
const RELOAD_FLAG = 'chunkReload';

function isChunkLoadError(error: unknown): boolean {
  if (error instanceof Error) {
    return CHUNK_ERROR_PATTERN.test(error.message) || CHUNK_ERROR_PATTERN.test(error.name);
  }
  if (typeof error === 'string') {
    return CHUNK_ERROR_PATTERN.test(error);
  }
  return false;
}

/**
 * Recovers from stale Next.js chunks after a deployment.
 *
 * When a user has an old tab open from a previous build, client-side navigation
 * can try to load a chunk that no longer exists on the server. Detect those
 * webpack chunk-load failures and reload the page so the browser fetches fresh
 * HTML and assets. A session flag prevents an infinite loop if the new build is
 * genuinely broken.
 */
export function ChunkErrorRecovery() {
  useEffect(() => {
    const recover = () => {
      if (typeof window === 'undefined' || window.sessionStorage.getItem(RELOAD_FLAG)) {
        return;
      }
      window.sessionStorage.setItem(RELOAD_FLAG, '1');
      const url = new URL(window.location.href);
      url.searchParams.set('_r', Date.now().toString());
      window.location.assign(url.toString());
    };

    const handleError = (event: ErrorEvent) => {
      if (isChunkLoadError(event.error)) {
        event.preventDefault();
        recover();
      }
    };

    const handleRejection = (event: PromiseRejectionEvent) => {
      if (isChunkLoadError(event.reason)) {
        event.preventDefault();
        recover();
      }
    };

    window.addEventListener('error', handleError);
    window.addEventListener('unhandledrejection', handleRejection);

    return () => {
      window.removeEventListener('error', handleError);
      window.removeEventListener('unhandledrejection', handleRejection);
    };
  }, []);

  useEffect(() => {
    // Clear the reload guard shortly after a successful load so future stale
    // chunks (e.g. after another deployment) can still trigger a recovery.
    const timer = window.setTimeout(() => {
      try {
        window.sessionStorage.removeItem(RELOAD_FLAG);
      } catch {
        // ignore
      }
    }, 5000);
    return () => window.clearTimeout(timer);
  }, []);

  return null;
}
