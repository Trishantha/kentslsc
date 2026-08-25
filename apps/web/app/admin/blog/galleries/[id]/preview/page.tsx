'use client';

import { useParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { Loader2, ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { api, getApiErrorMessage } from '@/lib/api';
import { GalleryPreview } from './GalleryPreview';
import type { AdminGallery } from '../../types';

export default function GalleryPreviewPage() {
  const { id } = useParams<{ id: string }>();

  const {
    data: gallery,
    isLoading,
    error
  } = useQuery<AdminGallery>({
    queryKey: ['admin', 'galleries', id],
    queryFn: async () => {
      const res = await api.get(`/galleries/admin/${id}`);
      return res.data;
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

  if (error || !gallery) {
    return (
      <div className="glass-card p-8 text-center">
        <h2 className="text-xl font-semibold text-red-400">Could not load gallery</h2>
        <p className="mt-2 text-slate-500">
          {error ? getApiErrorMessage(error) : 'Gallery not found.'}
        </p>
        <Link
          href="/admin/blog/galleries"
          className="mt-6 inline-flex items-center gap-2 text-sm font-medium text-neon-blue hover:underline"
        >
          <ArrowLeft className="h-4 w-4" /> Back to galleries
        </Link>
      </div>
    );
  }

  return (
    <div className="mt-6">
      <GalleryPreview gallery={gallery} />
    </div>
  );
}
