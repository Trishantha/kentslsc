'use client';

import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import type { MembershipResponse } from './types';

interface UseMyMembershipOptions {
  /**
   * Poll the membership until the payment has been recorded. Stripe webhooks
   * are processed asynchronously, so straight after checkout the membership can
   * still be unpaid for a few seconds. Polling makes the dashboard update on
   * its own instead of requiring a manual refresh.
   */
  pollUntilPaid?: boolean;
}

export const MEMBERSHIP_POLL_INTERVAL_MS = 3000;

export function useMyMembership(options?: UseMyMembershipOptions) {
  return useQuery<MembershipResponse | null>({
    queryKey: ['my-membership'],
    queryFn: async () => {
      const res = await api.get('/membership/me');
      return res.data;
    },
    retry: false,
    refetchInterval: options?.pollUntilPaid
      ? (query) => (query.state.data?.paidAt ? false : MEMBERSHIP_POLL_INTERVAL_MS)
      : false
  });
}
