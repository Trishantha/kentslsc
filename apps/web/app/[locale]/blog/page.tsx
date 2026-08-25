'use client';

import { useEffect, useState } from 'react';
import { Link } from '@/i18n/routing';
import { useTranslations } from 'next-intl';
import { api } from '@/lib/api';
import { formatDate } from '@/lib/utils';
import { summarizeRichText } from '@/lib/rich-text';

interface BlogPost {
  id: string;
  title: string;
  slug: string;
  imageUrl?: string;
  metaDescription?: string;
  tags?: string[];
  aiTldr?: string;
  publishedAt: string;
  createdAt: string;
}

export default function BlogPage() {
  const t = useTranslations('blog');
  const tCommon = useTranslations('common');
  const [posts, setPosts] = useState<BlogPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    api
      .get('/blog')
      .then((res) => setPosts(res.data))
      .catch(() => setError(t('loadError')))
      .finally(() => setLoading(false));
  }, [t]);

  return (
    <div className="px-4 py-16 md:px-6">
      <div className="mx-auto max-w-5xl">
        <h1 className="section-title">{t('title')}</h1>
        <p className="mt-4 text-slate-600 dark:text-slate-400">{t('subtitle')}</p>
        <Link
          href="/blog/gallery"
          className="mt-4 inline-flex items-center gap-2 text-sm font-medium text-neon-blue hover:underline"
        >
          {t('viewGallery')} →
        </Link>

        {loading && <p className="mt-10 text-slate-500">{tCommon('loading')}</p>}
        {error && <p className="mt-10 text-red-500">{error}</p>}

        <div className="mt-10 grid gap-8">
          {posts.map((post) => (
            <Link
              key={post.id}
              href={`/blog/${post.slug}`}
              className="group block"
            >
              <article className="glass-card flex flex-col gap-6 p-6 transition-shadow duration-300 hover:shadow-xl md:flex-row">
                {post.imageUrl ? (
                  <img
                    src={post.imageUrl}
                    alt={post.title}
                    className="h-48 w-full rounded-xl object-cover transition-transform duration-500 group-hover:scale-105 md:h-40 md:w-48"
                  />
                ) : (
                  <div className="h-48 w-full rounded-xl bg-gradient-to-br from-neon-purple/30 to-neon-blue/30 md:h-40 md:w-48" />
                )}
                <div className="flex flex-1 flex-col">
                  <h3 className="text-xl font-bold transition-colors group-hover:text-neon-blue">
                    {post.title}
                  </h3>
                  {post.metaDescription || post.aiTldr ? (
                    <p className="mt-2 line-clamp-2 text-sm text-slate-600 dark:text-slate-400">
                      {summarizeRichText(post.metaDescription || post.aiTldr, 180)}
                    </p>
                  ) : null}
                  {post.tags && post.tags.length > 0 && (
                    <div className="mt-3 flex flex-wrap gap-2">
                      {post.tags.slice(0, 4).map((tag) => (
                        <span
                          key={tag}
                          className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600 dark:bg-white/10 dark:text-slate-400"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  )}
                  <span className="mt-auto inline-block pt-4 text-xs font-medium text-slate-500">
                    {post.publishedAt
                      ? formatDate(post.publishedAt)
                      : formatDate(post.createdAt)}
                  </span>
                </div>
              </article>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
