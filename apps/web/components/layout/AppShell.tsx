'use client';

import { NextIntlClientProvider } from 'next-intl';
import type { AbstractIntlMessages } from 'next-intl';
import { MobileNavShell } from './MobileNavShell';
import { ConditionalFooter } from './ConditionalFooter';

interface AppShellProps {
  children: React.ReactNode;
  locale: string;
  messages: AbstractIntlMessages;
  timeZone: string;
}

export function AppShell({ children, locale, messages, timeZone }: AppShellProps) {
  return (
    <NextIntlClientProvider locale={locale} messages={messages} timeZone={timeZone}>
      <MobileNavShell>
        <div className="flex min-h-screen flex-col">
          <main className="flex-1 pb-[calc(64px+env(safe-area-inset-bottom))] md:pb-0">{children}</main>
          <ConditionalFooter />
        </div>
      </MobileNavShell>
    </NextIntlClientProvider>
  );
}
