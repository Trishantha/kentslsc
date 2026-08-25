'use client';

import { useState } from 'react';
import Image from 'next/image';
import { useTranslations } from 'next-intl';
import { useRouter } from '@/i18n/routing';
import { formatDate } from '@/lib/utils';
import { RichTextContent } from '@/components/ui/RichTextContent';
import { usePhotoLightbox } from '@/components/ui/PhotoLightbox';

interface Author {
  id: string;
  name: string;
}

interface GalleryPhoto {
  id: string;
  url: string;
  caption?: string | null;
  sortOrder: number;
}

interface Gallery {
  id: string;
  title: string;
  slug: string;
  description?: string | null;
  photos: GalleryPhoto[];
}

export interface BlogPost {
  id: string;
  title: string;
  slug: string;
  content: string;
  imageUrl?: string;
  metaDescription?: string | null;
  tags?: string[];
  gallery?: Gallery | null;
  aiTldr?: string;
  publishedAt: string;
  createdAt: string;
  updatedAt: string;
  author: Author;
}

interface Props {
  post: BlogPost;
}

export default function BlogPostContent({ post }: Props) {
  const t = useTranslations('blogDetail');
  const router = useRouter();
  const photos = (post.gallery?.photos ?? [])
    .slice()
    .sort((a, b) => a.sortOrder - b.sortOrder);
  const { open, Lightbox } = usePhotoLightbox(photos);

  const navigateToTag = (tag: string) => {
    router.push(`/blog?tag=${encodeURIComponent(tag)}`);
  };

  return (
    <div className="px-4 py-16 md:px-6">
      <div className="mx-auto max-w-3xl">
        <article className="glass-card p-8 md:p-12">
          {post.imageUrl ? (
            <div className="relative mb-8 h-64 w-full overflow-hidden rounded-xl">
              <Image
                src={post.imageUrl}
                alt={post.title}
                fill
                sizes="(max-width: 768px) 100vw, 768px"
                className="object-cover"
                priority
              />
            </div>
          ) : (
            <div className="mb-8 h-64 w-full rounded-xl bg-gradient-to-br from-neon-purple/30 to-neon-blue/30" />
          )}
          <h1 className="section-title">{post.title}</h1>
          <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-slate-500">
            <span>{t('byAuthor', { author: post.author?.name ?? t('fallbackAuthor') })}</span>
            <span>•</span>
            <span>{formatDate(post.publishedAt ?? post.createdAt)}</span>
          </div>

          {post.tags && post.tags.length > 0 && (
            <div className="mt-4 flex flex-wrap gap-1.5">
              {post.tags.map((tag) => (
                <button
                  key={tag}
                  type="button"
                  onClick={() => navigateToTag(tag)}
                  className="rounded-full bg-neon-blue/10 px-2 py-0.5 text-xs font-medium text-neon-blue transition-colors hover:bg-neon-blue/20"
                >
                  {tag}
                </button>
              ))}
            </div>
          )}

          <RichTextContent html={post.content} className="mt-8" />

          {post.gallery && (
            <div className="mt-12">
              <h2 className="text-xl font-bold">{post.gallery.title}</h2>
              {post.gallery.description && (
                <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">{post.gallery.description}</p>
              )}

              {photos.length > 0 ? (
                <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {photos.map((photo, index) => (
                    <PhotoCard
                      key={photo.id}
                      photo={photo}
                      galleryTitle={post.gallery!.title}
                      onClick={() => open(index)}
                    />
                  ))}
                </div>
              ) : (
                <p className="mt-4 text-sm text-slate-500">No photos in this gallery yet.</p>
              )}
            </div>
          )}
        </article>
      </div>
      <Lightbox />
    </div>
  );
}

interface PhotoCardProps {
  photo: GalleryPhoto;
  galleryTitle: string;
  onClick: () => void;
}

function PhotoCard({ photo, galleryTitle, onClick }: PhotoCardProps) {
  const [error, setError] = useState(false);
  const alt = photo.caption || galleryTitle;

  return (
    <button
      type="button"
      onClick={onClick}
      className="group relative overflow-hidden rounded-xl border border-white/10 bg-slate-800 text-left"
    >
      <div className="relative aspect-[4/3]">
        {photo.url && !error ? (
          <img
            src={photo.url}
            alt={alt}
            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
            loading="lazy"
            onError={() => setError(true)}
          />
        ) : (
          <div className="flex h-full w-full flex-col items-center justify-center gap-2 bg-slate-800 p-4 text-center text-slate-400">
            <span className="text-xs uppercase tracking-wider">Image unavailable</span>
            <span className="text-xs">{alt}</span>
          </div>
        )}
      </div>
      {photo.caption && (
        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent p-3 opacity-0 transition-opacity group-hover:opacity-100">
          <p className="text-xs text-white">{photo.caption}</p>
        </div>
      )}
    </button>
  );
}
