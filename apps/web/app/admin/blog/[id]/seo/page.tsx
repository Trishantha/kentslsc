import { fetchWithOriginFallback } from '@/lib/server-api-fetch';
import { notFound } from 'next/navigation';
import { BlogSeoForm } from './BlogSeoForm';
import type { AdminBlogPost } from '../../types';

interface Props {
  params: Promise<{ id: string }>;
}

async function getBlogPost(id: string): Promise<AdminBlogPost | null> {
  return fetchWithOriginFallback(`/api/blog/admin/posts/${id}`);
}

export default async function BlogSeoPage({ params }: Props) {
  const { id } = await params;
  const post = await getBlogPost(id);
  if (!post) notFound();

  return (
    <div className="max-w-3xl">
      <BlogSeoForm post={post} postId={id} />
    </div>
  );
}
