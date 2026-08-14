import { fetchWithOriginFallback } from '@/lib/server-api-fetch';
import { notFound } from 'next/navigation';
import { MembershipTypeFeaturesForm } from './MembershipTypeFeaturesForm';
import type { AdminMembershipType } from '../../types';

interface Props {
  params: Promise<{ id: string }>;
}

async function getMembershipType(id: string): Promise<AdminMembershipType | null> {
  const types = await fetchWithOriginFallback<AdminMembershipType[]>('/api/membership/types');
  if (!types) return null;
  return types.find((t) => t.id === id) ?? null;
}

export default async function MembershipTypeFeaturesPage({ params }: Props) {
  const { id } = await params;
  const type = await getMembershipType(id);
  if (!type) notFound();

  return (
    <div className="max-w-3xl">
      <MembershipTypeFeaturesForm membershipType={type} />
    </div>
  );
}
