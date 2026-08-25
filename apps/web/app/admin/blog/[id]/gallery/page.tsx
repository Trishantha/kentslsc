'use client';

import { useParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { Loader2, ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { api, getApiErrorMessage } from '@/lib/api';
import { GalleryManager } from './GalleryManager';
import type { AdminBlogPost } from '../../types';

export default function BlogGalleryPage() {
  const { id } = useParams<{ id: string }>();

  const {
    data: post,
    isLoading,
    error
  } = useQuery<AdminBlogPost>({
    queryKey: ['admin', 'blog', id],
    queryFn: async () => {
      const res = await api.get(`/blog/admin/posts/${id}`);
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

  if (error || !post) {
    return (
      <div className="glass-card p-8 text-center">
        <h2 className="text-xl font-semibold text-red-400">Could not load post</h2>
        <p className="mt-2 text-slate-500">
          {error ? getApiErrorMessage(error) : 'Post not found.'}
        </p>
        <Link
          href="/admin/blog"
          className="mt-6 inline-flex items-center gap-2 text-sm font-medium text-neon-blue hover:underline"
        >
          <ArrowLeft className="h-4 w-4" /> Back to blog posts
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-3xl">
      <GalleryManager post={post} />
    </div>
  );
}
