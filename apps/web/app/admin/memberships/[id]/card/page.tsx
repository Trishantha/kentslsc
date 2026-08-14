import { fetchWithOriginFallback } from '@/lib/server-api-fetch';
import { notFound } from 'next/navigation';
import { MembershipCardPanel } from './MembershipCardPanel';
import type { AdminMembership } from '../../types';

interface Props {
  params: Promise<{ id: string }>;
}

async function getMembership(id: string): Promise<AdminMembership | null> {
  return fetchWithOriginFallback(`/api/admin/memberships/${id}`);
}

export default async function MembershipCardPage({ params }: Props) {
  const { id } = await params;
  const membership = await getMembership(id);
  if (!membership) notFound();

  return <MembershipCardPanel membership={membership} />;
}
