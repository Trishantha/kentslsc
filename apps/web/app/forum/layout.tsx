import { requireSession } from '@/lib/auth-server';
import { AppShell } from '@/components/layout/AppShell';
import enMessages from '@/messages/en.json';

export default async function ForumLayout({ children }: { children: React.ReactNode }) {
  // Previously this had no guard at all and relied entirely on the middleware's
  // cookie-presence check. requireSession also enforces email verification.
  await requireSession();

  return (
    <AppShell locale="en" messages={enMessages} timeZone="Europe/London">
      {children}
    </AppShell>
  );
}
