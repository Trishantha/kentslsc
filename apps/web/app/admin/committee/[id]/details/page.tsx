import { fetchWithOriginFallback } from '@/lib/server-api-fetch';
import { notFound } from 'next/navigation';
import { CommitteeDetailsForm } from './CommitteeDetailsForm';
import type { AdminCommitteeMember } from '../../page';

interface Props {
  params: Promise<{ id: string }>;
}

async function getCommitteeMember(id: string): Promise<AdminCommitteeMember | null> {
  return fetchWithOriginFallback(`/api/admin/committee/${id}`);
}

export default async function CommitteeDetailsPage({ params }: Props) {
  const { id } = await params;
  const member = await getCommitteeMember(id);
  if (!member) notFound();

  return (
    <div className="max-w-3xl">
      <CommitteeDetailsForm member={member} memberId={id} />
    </div>
  );
}
