'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import type { Permission } from '@kentslsc/shared';

export interface AuthUser {
  id: string;
  name: string;
  firstName?: string;
  lastName?: string;
  email: string;
  phone?: string;
  address?: {
    buildingStreet: string;
    locality?: string;
    townCity: string;
    postcode: string;
  };
  role: 'ADMIN' | 'MEMBER' | 'BUSINESS_OWNER' | 'GUEST';
  permissions: Permission[];
  emailVerified: boolean;
  createdAt: string;
}

export function useAuth() {
  const query = useQuery<AuthUser | null>({
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

  return {
    ...query,
    user: query.data ?? null,
    loading: query.isLoading
  };
}

export function useSignOut() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      await api.post('/auth/logout');
    },
    onSuccess: () => {
      queryClient.setQueryData(['auth', 'me'], null);
      queryClient.invalidateQueries({ queryKey: ['auth', 'me'] });
      // Use a full page navigation to the login page so the middleware runs with
      // the cleared cookies and the browser fetches fresh HTML instead of
      // relying on a client-side transition that can hydrate with stale state.
      if (typeof window !== 'undefined') {
        window.location.href = '/auth/login';
      }
    }
  });
}
