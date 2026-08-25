'use client';

import Image from 'next/image';
import { useTranslations } from 'next-intl';
import { formatDate } from '@/lib/utils';
import { RichTextContent } from '@/components/ui/RichTextContent';

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
  const photos = (post.gallery?.photos ?? [])
    .slice()
    .sort((a, b) => a.sortOrder - b.sortOrder);

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
            <div className="mt-4 flex flex-wrap gap-2">
              {post.tags.map((tag) => (
                <span
                  key={tag}
                  className="rounded-full bg-white/5 px-3 py-1 text-xs font-medium text-slate-400"
                >
                  {tag}
                </span>
              ))}
            </div>
          )}

          {post.aiTldr && (
            <div className="mt-6 rounded-xl border border-neon-blue/20 bg-neon-blue/5 p-4 dark:bg-neon-blue/10">
              <p className="text-sm font-semibold text-neon-blue">{t('aiTldr')}</p>
              <p className="mt-1 text-slate-700 dark:text-slate-300">{post.aiTldr}</p>
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
                  {photos.map((photo) => (
                    <div
                      key={photo.id}
                      className="group relative overflow-hidden rounded-xl border border-white/10 bg-slate-800"
                    >
                      <div className="aspect-[4/3]">
                        <Image
                          src={photo.url}
                          alt={photo.caption || post.gallery!.title}
                          fill
                          sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                          className="object-cover"
                          loading="lazy"
                        />
                      </div>
                      {photo.caption && (
                        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent p-3 opacity-0 transition-opacity group-hover:opacity-100">
                          <p className="text-xs text-white">{photo.caption}</p>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="mt-4 text-sm text-slate-500">No photos in this gallery yet.</p>
              )}
            </div>
          )}
        </article>
      </div>
    </div>
  );
}
