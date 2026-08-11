import { getRequestConfig } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { routing } from './routing';

export default getRequestConfig(async ({ requestLocale }) => {
  const locale = await requestLocale;

  if (!locale || !routing.locales.includes(locale as (typeof routing.locales)[number])) {
    notFound();
  }

  return {
    locale,
    timeZone: 'Europe/London',
    messages: (await import(`../messages/${locale}.json`)).default
  };
});
