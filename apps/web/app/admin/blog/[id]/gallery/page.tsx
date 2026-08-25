import { fetchWithOriginFallback } from '@/lib/server-api-fetch';
import { notFound } from 'next/navigation';
import { GalleryManager } from './GalleryManager';
import type { AdminBlogPost } from '../../types';

interface Props {
  params: Promise<{ id: string }>;
}

async function fetchPost(id: string): Promise<AdminBlogPost | null> {
  return fetchWithOriginFallback(`/api/blog/admin/posts/${id}`);
}

export default async function BlogGalleryPage({ params }: Props) {
  const { id } = await params;
  const post = await fetchPost(id);
  if (!post) notFound();

  return (
    <div className="max-w-3xl">
      <GalleryManager post={post} />
    </div>
  );
}
