import { getMessages, setRequestLocale } from 'next-intl/server';
import { AppShell } from '@/components/layout/AppShell';
import { routing } from '@/i18n/routing';

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export default async function LocaleLayout({
  children,
  params
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const messages = await getMessages();

  return (
    <AppShell locale={locale} messages={messages} timeZone="Europe/London">
      {children}
    </AppShell>
  );
}
