'use client';

import { useParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { Loader2, ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { api, getApiErrorMessage } from '@/lib/api';
import { MembershipTypeDetailsForm } from './MembershipTypeDetailsForm';
import type { AdminMembershipType } from '../../types';

export default function MembershipTypeDetailsPage() {
  const { id } = useParams<{ id: string }>();

  const {
    data: membershipType,
    isLoading,
    error
  } = useQuery<AdminMembershipType>({
    queryKey: ['admin', 'membership-types', id],
    queryFn: async () => {
      const res = await api.get<AdminMembershipType[]>('/membership/types');
      const type = res.data.find((t) => t.id === id);
      if (!type) throw new Error('Membership type not found.');
      return type;
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

  if (error || !membershipType) {
    return (
      <div className="glass-card p-8 text-center">
        <h2 className="text-xl font-semibold text-red-400">Could not load membership type</h2>
        <p className="mt-2 text-slate-500">
          {error ? getApiErrorMessage(error) : 'Membership type not found.'}
        </p>
        <Link
          href="/admin/membership-types"
          className="mt-6 inline-flex items-center gap-2 text-sm font-medium text-neon-blue hover:underline"
        >
          <ArrowLeft className="h-4 w-4" /> Back to membership types
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-3xl">
      <MembershipTypeDetailsForm membershipType={membershipType} />
    </div>
  );
}
