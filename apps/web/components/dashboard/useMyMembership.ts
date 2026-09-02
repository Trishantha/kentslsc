'use client';

import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import type { MembershipResponse } from './types';

export function useMyMembership() {
  return useQuery<MembershipResponse | null>({
    queryKey: ['my-membership'],
    queryFn: async () => {
      const res = await api.get('/membership/me');
      return res.data;
    },
    retry: false
  });
}
