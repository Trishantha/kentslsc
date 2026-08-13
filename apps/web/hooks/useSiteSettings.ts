'use client';

import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { type SiteSettingsInput } from '@kentslsc/shared';

export interface SiteSettings extends SiteSettingsInput {
  id: string;
  createdAt: string;
  updatedAt: string;
}

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
