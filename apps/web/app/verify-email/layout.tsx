import { redirect } from 'next/navigation';
import { getServerSession } from '@/lib/auth-server';
import { AppShell } from '@/components/layout/AppShell';
import enMessages from '@/messages/en.json';

export default async function VerifyEmailLayout({ children }: { children: React.ReactNode }) {
  const session = await getServerSession();

  // Signed out: nothing to verify here — the emailed link lands on the
  // locale-prefixed page instead.
  if (!session.authenticated) {
    redirect('/auth/login');
  }
  // Already verified: don't strand the user on a dead-end screen.
  if (session.emailVerified) {
    redirect('/dashboard');
  }

  return (
    <AppShell locale="en" messages={enMessages} timeZone="Europe/London">
      {children}
    </AppShell>
  );
}
