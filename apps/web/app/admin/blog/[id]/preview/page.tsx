import { fetchWithOriginFallback } from '@/lib/server-api-fetch';
import { notFound } from 'next/navigation';
import { BlogPreview } from './BlogPreview';
import type { AdminBlogPost } from '../../types';

interface Props {
  params: Promise<{ id: string }>;
}

async function getBlogPost(id: string): Promise<AdminBlogPost | null> {
  return fetchWithOriginFallback(`/api/blog/admin/posts/${id}`);
}

export default async function BlogPreviewPage({ params }: Props) {
  const { id } = await params;
  const post = await getBlogPost(id);
  if (!post) notFound();

  return <BlogPreview post={post} />;
}
