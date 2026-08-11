import { getMessages, setRequestLocale } from 'next-intl/server';
import { AppShell } from '@/components/layout/AppShell';
import { routing } from '@/i18n/routing';

export const dynamic = 'force-dynamic';

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export default async function LocaleLayout({
  children,
  params: { locale }
}: {
  children: React.ReactNode;
  params: { locale: string };
}) {
  setRequestLocale(locale);
  const messages = await getMessages();

  return (
    <AppShell locale={locale} messages={messages} timeZone="Europe/London">
      {children}
    </AppShell>
  );
}
