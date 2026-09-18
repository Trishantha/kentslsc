import { setRequestLocale } from 'next-intl/server';
import { AppShell } from '@/components/layout/AppShell';
import { pickMessages } from '@/components/i18n/ServerMessagesProvider';
import { getRequestMessages } from '@/components/i18n/request-messages';
import { routing } from '@/i18n/routing';

// Namespaces used by always-mounted shell components (Navbar, mobile menus,
// footer). Page-specific namespaces are provided by nested
// ServerMessagesProvider instances on the pages that need them, so visitors
// don't download the entire dictionary with the shell.
const SHELL_MESSAGE_NAMESPACES = ['nav', 'footer', 'mobileMenu', 'mobileBottomNav'];

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
  // Prime the per-request messages promise BEFORE any nested layout or page
  // renders: this await is what makes later getRequestMessages() calls safe
  // (see request-messages.ts).
  const messages = pickMessages(await getRequestMessages(), SHELL_MESSAGE_NAMESPACES);

  return (
    <AppShell locale={locale} messages={messages} timeZone="Europe/London">
      {children}
    </AppShell>
  );
}
