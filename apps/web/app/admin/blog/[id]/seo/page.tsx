'use client';

import { BlogSeoForm } from './BlogSeoForm';
import { useBlogPost } from '../BlogPostProvider';

export default function BlogSeoPage() {
  const post = useBlogPost();

  return (
    <div className="max-w-3xl">
      <BlogSeoForm post={post} postId={post.id} />
    </div>
  );
}
