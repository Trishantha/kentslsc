import { fetchWithOriginFallback } from '@/lib/server-api-fetch';
import { notFound } from 'next/navigation';
import { BlogContentForm } from './BlogContentForm';
import type { AdminBlogPost } from '../../types';

interface Props {
  params: Promise<{ id: string }>;
}

async function getBlogPost(id: string): Promise<AdminBlogPost | null> {
  return fetchWithOriginFallback(`/api/blog/admin/posts/${id}`);
}

export default async function BlogContentPage({ params }: Props) {
  const { id } = await params;
  const post = await getBlogPost(id);
  if (!post) notFound();

  return (
    <div className="max-w-3xl">
      <BlogContentForm post={post} postId={id} />
    </div>
  );
}
