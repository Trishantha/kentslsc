'use client';

import { BlogPreview } from './BlogPreview';
import { useBlogPost } from '../BlogPostProvider';

export default function BlogPreviewPage() {
  const post = useBlogPost();

  return <BlogPreview post={post} />;
}
