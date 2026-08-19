import { requirePermission } from '@/lib/auth-server';
import { Permission } from '@kentslsc/shared';
import MembershipScanHistory from './MembershipScanHistory';

export default async function MembershipScanHistoryPage() {
  await requirePermission(Permission.SCAN_MEMBERSHIPS);
  return <MembershipScanHistory />;
}
