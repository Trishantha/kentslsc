'use client';

import { useParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { Loader2 } from 'lucide-react';
import { api, getApiErrorMessage } from '@/lib/api';
import { CommitteeDetailsForm } from './CommitteeDetailsForm';
import type { AdminCommitteeMember } from '../../page';

export default function CommitteeDetailsPage() {
  const { id } = useParams<{ id: string }>();

  const {
    data: member,
    isLoading,
    error
  } = useQuery<AdminCommitteeMember>({
    queryKey: ['admin', 'committee', id],
    queryFn: async () => {
      const res = await api.get(`/admin/committee/${id}`);
      return res.data;
    },
    enabled: !!id
  });

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-neon-blue" />
      </div>
    );
  }

  if (error || !member) {
    return (
      <div className="glass-card p-6 text-center text-red-400">
        <p>{error ? getApiErrorMessage(error) : 'Committee member not found.'}</p>
      </div>
    );
  }

  return (
    <div className="max-w-3xl">
      <CommitteeDetailsForm member={member} memberId={id} />
    </div>
  );
}
