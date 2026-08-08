'use client';

import { useEffect, useState } from 'react';

function getHydrationSnapshot() {
  if (typeof document === 'undefined') return null;
  const html = document.documentElement;
  const body = document.body;
  const cssLink = document.querySelector('link[rel="stylesheet"][href*="/css/"]');
  const allStyles = Array.from(document.querySelectorAll('style, link[rel="stylesheet"]'));

  return {
    timestamp: new Date().toISOString(),
    url: window.location.href,
    htmlTag: html.tagName,
    htmlClass: html.className,
    htmlAttributeCount: html.attributes.length,
    bodyClass: body?.className ?? 'NO_BODY',
    bodyChildCount: body?.children.length ?? -1,
    nestedHtmlCount: document.querySelectorAll('html').length,
    nestedBodyCount: document.querySelectorAll('body').length,
    cssLinkPresent: !!cssLink,
    cssLinkHref: cssLink?.getAttribute('href') ?? null,
    styleAndLinkCount: allStyles.length
  };
}

export function DebugHydration() {
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    const before = getHydrationSnapshot();
    // eslint-disable-next-line no-console
    console.log('[KENTSLSC-DEBUG] Hydration/effect running', before);

    const timer = setTimeout(() => {
      const after = getHydrationSnapshot();
      // eslint-disable-next-line no-console
      console.log('[KENTSLSC-DEBUG] Post-hydration state', after);
      setHydrated(true);
    }, 500);

    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!hydrated) return;

    const observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        if (mutation.type === 'attributes' && (mutation.target === document.documentElement || mutation.target === document.body)) {
          // eslint-disable-next-line no-console
          console.log('[KENTSLSC-DEBUG] DOM attribute mutation', {
            target: (mutation.target as Element).tagName,
            attributeName: mutation.attributeName,
            newValue: (mutation.target as Element).getAttribute(mutation.attributeName as string),
            snapshot: getHydrationSnapshot()
          });
        }
      }
    });

    observer.observe(document.documentElement, { attributes: true, attributeOldValue: true });
    observer.observe(document.body, { attributes: true, attributeOldValue: true });

    return () => observer.disconnect();
  }, [hydrated]);

  return null;
}
