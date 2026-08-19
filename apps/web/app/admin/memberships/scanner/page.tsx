import { requirePermission } from '@/lib/auth-server';
import { Permission } from '@kentslsc/shared';
import MembershipScanner from './MembershipScanner';

export default async function MembershipScannerPage() {
  await requirePermission(Permission.SCAN_MEMBERSHIPS);
  return <MembershipScanner />;
}
