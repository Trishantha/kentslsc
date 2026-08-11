import { requireRole } from '@/lib/auth-server';
import { AdminShell } from './AdminShell';

/**
 * Server-side admin gate.
 *
 * The admin area used to be protected only by a useEffect redirect in a client
 * component, so the HTML and the navigation were served to anyone with any
 * session and only bounced after hydration. The API guards meant no data
 * leaked, but the shell was still visible. This resolves the role before any
 * markup is produced.
 */
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  await requireRole('ADMIN');
  return <AdminShell>{children}</AdminShell>;
}
