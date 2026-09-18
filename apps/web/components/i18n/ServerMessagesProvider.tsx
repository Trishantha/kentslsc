import type { ReactNode } from 'react';
import { NextIntlClientProvider } from 'next-intl';
import type { AbstractIntlMessages } from 'next-intl';
import { getRequestMessages } from './request-messages';

/**
 * Extract a subset of the locale messages by top-level namespace.
 * Used to limit what client components receive from NextIntlClientProvider
 * instead of shipping the entire dictionary to every visitor.
 */
export function pickMessages(
  messages: AbstractIntlMessages,
  namespaces: string[]
): AbstractIntlMessages {
  return Object.fromEntries(
    namespaces
      .filter((ns) => ns in messages && messages[ns] !== undefined)
      .map((ns) => [ns, messages[ns] as string | AbstractIntlMessages])
  );
}

interface ServerMessagesProviderProps {
  namespaces: string[];
  children: ReactNode;
}

/**
 * Nested NextIntlClientProvider carrying only the given message namespaces.
 *
 * Messages are read through getRequestMessages(), which the [locale] layout
 * resolves first — calling next-intl's getMessages() (request headers) as
 * the first suspension of a tree collapses the streamed shell to the
 * loading fallback, so this provider must not be the first async unit
 * rendered for a route.
 *
 * Nested providers inherit locale and timeZone from the outer (shell)
 * provider; their messages REPLACE the outer ones for the subtree, so the
 * namespaces listed here must cover every useTranslations namespace rendered
 * below.
 */
export async function ServerMessagesProvider({
  namespaces,
  children
}: ServerMessagesProviderProps) {
  // Yield one macrotask before touching request-scoped APIs: when this
  // provider renders during a page's first synchronous SSR pass, React 19's
  // prerender collapses the streamed shell to the loading fallback (the
  // navbar is lost). Awaiting any real async work first lets the shell
  // stream correctly.
  await new Promise((resolve) => setTimeout(resolve, 0));
  const messages = pickMessages(await getRequestMessages(), namespaces);
  return (
    <NextIntlClientProvider messages={messages}>
      {children}
    </NextIntlClientProvider>
  );
}
