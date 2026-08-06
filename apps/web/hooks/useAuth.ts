'use client';

import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  role: string;
}

export function useAuth() {
  return useQuery<AuthUser | null>({
    queryKey: ['auth', 'me'],
    queryFn: async () => {
      try {
        const { data } = await api.get<AuthUser>('/auth/me');
        return data;
      } catch {
        return null;
      }
    },
    retry: false,
    staleTime: 5 * 60 * 1000
  });
}
