'use client';

import { BlogContentForm } from './BlogContentForm';
import { useBlogPost } from '../BlogPostProvider';

export default function BlogContentPage() {
  const post = useBlogPost();

  return (
    <div className="max-w-3xl">
      <BlogContentForm post={post} postId={post.id} />
    </div>
  );
}
