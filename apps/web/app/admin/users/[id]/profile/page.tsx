'use client';

import { useParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { Loader2, User } from 'lucide-react';
import { api } from '@/lib/api';
import { formatDate } from '@/lib/utils';
import type { UserDetail, StructuredAddress } from '../../types';

function formatAddress(address?: StructuredAddress | null) {
  if (!address) return '-';
  const parts = [address.buildingStreet, address.locality, address.townCity, address.postcode].filter(Boolean);
  return parts.join(', ');
}

export default function UserProfilePage() {
  const { id } = useParams<{ id: string }>();

  const { data: detail, isLoading } = useQuery<UserDetail>({
    queryKey: ['admin', 'users', id],
    queryFn: async () => {
      const res = await api.get(`/admin/users/${id}`);
      return res.data;
    },
    enabled: !!id
  });

  if (isLoading || !detail) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-neon-blue" />
      </div>
    );
  }

  return (
    <div className="max-w-3xl">
      <section className="glass-card p-5">
        <h3 className="mb-4 flex items-center gap-2 text-lg font-semibold">
          <User className="h-5 w-5 text-neon-blue" /> Personal Information
        </h3>
        <dl className="grid gap-3 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-slate-500">First Name</dt>
            <dd className="font-medium">{detail.firstName || '-'}</dd>
          </div>
          <div>
            <dt className="text-slate-500">Last Name</dt>
            <dd className="font-medium">{detail.lastName || '-'}</dd>
          </div>
          <div>
            <dt className="text-slate-500">Email</dt>
            <dd className="font-medium">{detail.email}</dd>
          </div>
          <div>
            <dt className="text-slate-500">Phone</dt>
            <dd className="font-medium">{detail.phone || '-'}</dd>
          </div>
          <div className="sm:col-span-2">
            <dt className="text-slate-500">Address</dt>
            <dd className="font-medium">{formatAddress(detail.address)}</dd>
          </div>
          <div>
            <dt className="text-slate-500">Role</dt>
            <dd className="font-medium">
              <span className="rounded-full bg-neon-gold/10 px-2 py-1 text-xs font-semibold text-neon-gold">
                {detail.role}
              </span>
            </dd>
          </div>
          <div>
            <dt className="text-slate-500">Joined</dt>
            <dd className="font-medium">{formatDate(detail.createdAt)}</dd>
          </div>
        </dl>
      </section>
    </div>
  );
}
