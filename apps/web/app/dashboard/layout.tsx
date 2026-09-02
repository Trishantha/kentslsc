import { requireSession } from '@/lib/auth-server';
import { MemberShell } from '@/components/layout/MemberShell';

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  // Previously this had no guard at all and relied entirely on the middleware's
  // cookie-presence check. requireSession also enforces email verification.
  await requireSession();

  return <MemberShell>{children}</MemberShell>;
}
