'use client';

import { useEffect, useState } from 'react';

/**
 * Read URL search params from the browser address bar without Next.js' useSearchParams.
 *
 * useSearchParams forces the nearest Suspense boundary to render its fallback on the
 * server and during hydration, which can leave auth pages stuck on "Loading..." in
 * static/unified deployments. This hook returns null on the initial render (SSR /
 * hydration) and the real URLSearchParams after the effect fires on the client.
 */
export function useClientSearchParams(): URLSearchParams | null {
  const [searchParams, setSearchParams] = useState<URLSearchParams | null>(null);

  useEffect(() => {
    setSearchParams(new URLSearchParams(window.location.search));
  }, []);

  return searchParams;
}
