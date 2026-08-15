'use client';

import { NextIntlClientProvider } from 'next-intl';
import type { AbstractIntlMessages } from 'next-intl';
import { ChunkErrorRecovery } from '@/components/ChunkErrorRecovery';
import { PageTransitionLoader } from '@/components/PageTransitionLoader';
import { useSiteSettings } from '@/hooks/useSiteSettings';
import { MobileNavShell } from './MobileNavShell';
import { ConditionalFooter } from './ConditionalFooter';
import { CookieConsentBanner } from '@/components/ui/CookieConsentBanner';

interface AppShellProps {
  children: React.ReactNode;
  locale: string;
  messages: AbstractIntlMessages;
  timeZone: string;
}

export function AppShell({ children, locale, messages, timeZone }: AppShellProps) {
  const { data: settings } = useSiteSettings();
  const showPageLoader = settings?.showPageLoader !== false;

  return (
    <NextIntlClientProvider locale={locale} messages={messages} timeZone={timeZone}>
      <ChunkErrorRecovery />
      {showPageLoader && <PageTransitionLoader />}
      <MobileNavShell>
        <div className="flex min-h-screen flex-col">
          <main className="flex-1 pb-[calc(64px+env(safe-area-inset-bottom))] md:pb-0">{children}</main>
          <ConditionalFooter />
        </div>
        <CookieConsentBanner />
      </MobileNavShell>
    </NextIntlClientProvider>
  );
}
