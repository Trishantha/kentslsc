'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Loader2, Images, Plus, ArrowUpRight } from 'lucide-react';
import Link from 'next/link';
import { api } from '@/lib/api';
import type { AdminBlogPost, AdminGallery } from '../../types';

interface GalleryManagerProps {
  post: AdminBlogPost;
}

function GalleryCard({ gallery, postId }: { gallery: AdminGallery; postId: string }) {
  return (
    <div className="glass-card space-y-4 p-6">
      <div className="flex items-start gap-3">
        <Images className="mt-1 h-5 w-5 text-neon-purple" />
        <div>
          <h2 className="text-lg font-semibold">{gallery.title}</h2>
          <p className="text-sm text-slate-500">/{gallery.slug}</p>
          {gallery.description && (
            <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">{gallery.description}</p>
          )}
          <p className="mt-2 text-sm text-slate-500">
            {gallery.photos.length} photo{gallery.photos.length === 1 ? '' : 's'}
          </p>
        </div>
      </div>

      <div className="flex flex-wrap gap-3">
        <Link
          href={`/admin/blog/galleries/${gallery.id}/photos`}
          className="btn-primary inline-flex items-center gap-2"
        >
          <ArrowUpRight className="h-4 w-4" />
          Manage photos
        </Link>
        <Link
          href={`/admin/blog/galleries/${gallery.id}/content`}
          className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-medium hover:bg-white/10"
        >
          Edit gallery details
        </Link>
      </div>

      <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-4">
        <p className="text-sm text-amber-400">
          This gallery is linked to the current blog post. Photos uploaded here will appear in the public post page.
        </p>
      </div>
    </div>
  );
}

function CreateGalleryPrompt({ post }: { post: AdminBlogPost }) {
  const queryClient = useQueryClient();
  const createMutation = useMutation({
    mutationFn: async () => {
      const baseSlug = post.slug;
      const res = await api.post('/galleries/admin', {
        title: `${post.title} Gallery`,
        slug: `${baseSlug}-gallery`,
        description: `Photo gallery for "${post.title}"`,
        isPublished: true,
        photos: []
      });
      return res.data as AdminGallery;
    },
    onSuccess: async (gallery) => {
      await api.put(`/admin/blog/posts/${post.id}`, { galleryId: gallery.id });
      queryClient.invalidateQueries({ queryKey: ['admin', 'blog', post.id] });
      queryClient.invalidateQueries({ queryKey: ['admin', 'galleries'] });
    }
  });

  return (
    <div className="glass-card space-y-4 p-6">
      <div className="flex items-start gap-3">
        <Images className="mt-1 h-5 w-5 text-neon-purple" />
        <div>
          <h2 className="text-lg font-semibold">No gallery linked</h2>
          <p className="mt-1 text-sm text-slate-500">
            This post does not have a photo gallery yet. Create one and it will be linked automatically.
          </p>
        </div>
      </div>

      <button
        type="button"
        onClick={() => createMutation.mutate()}
        disabled={createMutation.isPending}
        className="btn-primary inline-flex items-center gap-2"
      >
        {createMutation.isPending ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Plus className="h-4 w-4" />
        )}
        Create gallery for this post
      </button>

      <p className="text-sm text-slate-500">
        Or select an existing gallery from the Content tab.
      </p>
    </div>
  );
}

export function GalleryManager({ post }: GalleryManagerProps) {
  return post.gallery ? (
    <GalleryCard gallery={post.gallery} postId={post.id} />
  ) : (
    <CreateGalleryPrompt post={post} />
  );
}
