import { cache } from 'react';
import { getMessages } from 'next-intl/server';
import type { AbstractIntlMessages } from 'next-intl';

/**
 * Full locale messages for the current request, resolved exactly once.
 *
 * MUST be awaited first by the [locale] layout: next-intl's getMessages()
 * reads request headers, and when a headers() call is the FIRST suspension
 * in a server component tree, React 19's prerender collapses the streamed
 * shell to the loading fallback (the navbar is lost). Once the layout has
 * resolved this promise, any nested layout or page can await the cached
 * value safely because React `cache()` dedupes per request and the promise
 * is already settled.
 */
export const getRequestMessages: () => Promise<AbstractIntlMessages> = cache(
  async () => getMessages() as Promise<AbstractIntlMessages>
);
