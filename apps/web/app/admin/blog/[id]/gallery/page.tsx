'use client';

import { GalleryManager } from './GalleryManager';
import { useBlogPost } from '../BlogPostProvider';

export default function BlogGalleryPage() {
  const post = useBlogPost();

  return (
    <div className="max-w-3xl">
      <GalleryManager post={post} />
    </div>
  );
}
