import { getRequestConfig } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { DEFAULT_LOCALE } from '@kentslsc/shared';
import { routing } from './routing';

const defaultMessages = {
  en: (await import('../messages/en.json')).default,
  si: (await import('../messages/si.json')).default,
  ta: (await import('../messages/ta.json')).default
};

export default getRequestConfig(async ({ requestLocale }) => {
  const locale = await requestLocale;

  // A missing locale is expected during partial (flight/RSC) renders: the
  // [locale] layout — the only place setRequestLocale runs — is a static
  // segment, so Next serves it from cache and executes only the dynamic page
  // slot, leaving the request locale unseeded. 404ing here used to inject
  // NEXT_HTTP_ERROR_FALLBACK;404 into every client-side navigation on pages
  // using ServerMessagesProvider. Fall back to the default locale instead.
  // A present-but-unsupported locale is still a hard 404.
  if (!locale) {
    return {
      locale: DEFAULT_LOCALE,
      timeZone: 'Europe/London',
      messages: defaultMessages[DEFAULT_LOCALE]
    };
  }

  if (!routing.locales.includes(locale as (typeof routing.locales)[number])) {
    notFound();
  }

  return {
    locale,
    timeZone: 'Europe/London',
    messages: defaultMessages[locale as keyof typeof defaultMessages] ?? defaultMessages.en
  };
});
