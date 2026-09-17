'use client';

import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { type SiteSettings } from '@kentslsc/shared';

export function useSiteSettings() {
  return useQuery<SiteSettings>({
    queryKey: ['site-settings'],
    queryFn: async () => {
      const { data } = await api.get<SiteSettings>('/site-settings');
      return data;
    },
    staleTime: 5 * 60 * 1000,
    retry: false
  });
}
