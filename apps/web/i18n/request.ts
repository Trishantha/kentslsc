import { getRequestConfig } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { routing } from './routing';

const defaultMessages = {
  en: (await import('../messages/en.json')).default,
  si: (await import('../messages/si.json')).default,
  ta: (await import('../messages/ta.json')).default
};

export default getRequestConfig(async ({ requestLocale }) => {
  const locale = await requestLocale;

  if (!locale || !routing.locales.includes(locale as (typeof routing.locales)[number])) {
    notFound();
  }

  return {
    locale,
    timeZone: 'Europe/London',
    messages: defaultMessages[locale as keyof typeof defaultMessages] ?? defaultMessages.en
  };
});
