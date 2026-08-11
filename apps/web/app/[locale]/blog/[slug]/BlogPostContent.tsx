'use client';

import Image from 'next/image';
import { useTranslations } from 'next-intl';
import { formatDate } from '@/lib/utils';
import { RichTextContent } from '@/components/ui/RichTextContent';

interface Author {
  id: string;
  name: string;
}

export interface BlogPost {
  id: string;
  title: string;
  slug: string;
  content: string;
  imageUrl?: string;
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
          <div className="mt-2 flex items-center gap-2 text-sm text-slate-500">
            <span>{t('byAuthor', { author: post.author?.name ?? t('fallbackAuthor') })}</span>
            <span>•</span>
            <span>{formatDate(post.publishedAt ?? post.createdAt)}</span>
          </div>

          {post.aiTldr && (
            <div className="mt-6 rounded-xl border border-neon-blue/20 bg-neon-blue/5 p-4 dark:bg-neon-blue/10">
              <p className="text-sm font-semibold text-neon-blue">{t('aiTldr')}</p>
              <p className="mt-1 text-slate-700 dark:text-slate-300">{post.aiTldr}</p>
            </div>
          )}

          <RichTextContent html={post.content} className="mt-8" />
        </article>
      </div>
    </div>
  );
}
