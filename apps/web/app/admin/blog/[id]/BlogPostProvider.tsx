'use client';

import { createContext, useContext, type ReactNode } from 'react';
import { useParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { Loader2, ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { api, getApiErrorMessage } from '@/lib/api';
import type { AdminBlogPost } from '../types';

const BlogPostContext = createContext<AdminBlogPost | null>(null);

export function useBlogPost(): AdminBlogPost {
  const post = useContext(BlogPostContext);
  if (!post) {
    throw new Error('useBlogPost must be used within a BlogPostProvider');
  }
  return post;
}

interface BlogPostProviderProps {
  children: ReactNode;
}

export function BlogPostProvider({ children }: BlogPostProviderProps) {
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
          {error ? getApiErrorMessage(error) : 'Post not found or it may have been deleted.'}
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

  return <BlogPostContext.Provider value={post}>{children}</BlogPostContext.Provider>;
}
