'use client';

import { useQuery } from '@tanstack/react-query';
import { MembershipFeature } from '@kentslsc/shared';
import { api } from '@/lib/api';

export function useFeatures() {
  return useQuery<MembershipFeature[]>({
    queryKey: ['auth', 'features'],
    queryFn: async () => {
      try {
        const { data } = await api.get<MembershipFeature[]>('/auth/features');
        return data;
      } catch {
        return [];
      }
    },
    retry: false,
    staleTime: 5 * 60 * 1000
  });
}

export function useHasFeature(feature: MembershipFeature): boolean {
  const { data: features = [] } = useFeatures();
  return features.includes(feature);
}
