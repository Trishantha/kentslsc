'use client';

import { useParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { Loader2 } from 'lucide-react';
import { api } from '@/lib/api';
import { MembershipDetailsForm } from './MembershipDetailsForm';
import type { AdminMembership } from '../../types';

export default function MembershipDetailsPage() {
  const { id } = useParams<{ id: string }>();

  const { data: membership, isLoading } = useQuery<AdminMembership>({
    queryKey: ['admin', 'memberships', id],
    queryFn: async () => {
      const res = await api.get(`/admin/memberships/${id}`);
      return res.data;
    },
    enabled: !!id,
    // Payment status is updated out-of-band by the Stripe webhook, so always
    // show admins the current state rather than a cached "Unpaid".
    staleTime: 0,
    refetchOnWindowFocus: true
  });

  if (isLoading || !membership) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-neon-blue" />
      </div>
    );
  }

  return <MembershipDetailsForm membership={membership} />;
}
