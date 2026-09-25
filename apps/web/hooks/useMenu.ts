'use client';

import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import type { MenuItemNode } from '@kentslsc/shared';

export function useMenu() {
  return useQuery<MenuItemNode[]>({
    queryKey: ['menu'],
    queryFn: async () => {
      const { data } = await api.get<MenuItemNode[]>('/menus/public');
      return data;
    },
    staleTime: 5 * 60 * 1000,
    retry: false
  });
}

export function getMenuLabel(node: MenuItemNode, locale: string): string {
  if (locale === 'si' && node.labelSi) return node.labelSi;
  if (locale === 'ta' && node.labelTa) return node.labelTa;
  return node.labelEn;
}
