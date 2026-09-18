'use client';

import { Suspense, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { Link, useRouter } from '@/i18n/routing';
import { useTranslations } from 'next-intl';
import { X } from 'lucide-react';
import { api } from '@/lib/api';
import { formatDate } from '@/lib/utils';
import { summarizeRichText } from '@/lib/rich-text';
import type { MixedBlogListItem } from '@kentslsc/shared';

function BlogPageContent() {
  const t = useTranslations('blog');
  const tCommon = useTranslations('common');
  const router = useRouter();
  const searchParams = useSearchParams();
  const activeTag = searchParams.get('tag') ?? '';
  const [posts, setPosts] = useState<MixedBlogListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    api
      .get('/blog')
      .then((res) => setPosts(res.data))
      .catch(() => setError(t('loadError')))
      .finally(() => setLoading(false));
  }, [t]);

  const filteredPosts = useMemo(() => {
    if (!activeTag) return posts;
    return posts.filter(
      (post) => post.type === 'blog' && post.tags?.some((tag) => tag.toLowerCase() === activeTag.toLowerCase())
    );
  }, [posts, activeTag]);

  const clearTag = () => router.push('/blog');
  const navigateToTag = (tag: string) => router.push(`/blog?tag=${encodeURIComponent(tag)}`);

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

        {activeTag && (
          <div className="mt-6 flex items-center gap-3">
            <span className="text-sm text-slate-600 dark:text-slate-400">
              {t('filteredBy')}
            </span>
            <span className="inline-flex items-center gap-1 rounded-full bg-neon-blue/10 px-3 py-1 text-xs font-medium text-neon-blue">
              {activeTag}
              <button
                type="button"
                onClick={clearTag}
                className="ml-1 rounded-full p-0.5 hover:bg-neon-blue/20"
                aria-label={t('clearTagFilter')}
              >
                <X className="h-3 w-3" />
              </button>
            </span>
          </div>
        )}

        {loading && <p className="mt-10 text-slate-500">{tCommon('loading')}</p>}
        {error && <p className="mt-10 text-red-500">{error}</p>}

        <div className="mt-10 grid gap-8">
          {!loading && filteredPosts.length === 0 ? (
            <p className="text-slate-600 dark:text-slate-400">
              {activeTag ? t('noPostsForTag') : t('noPosts')}
            </p>
          ) : (
            filteredPosts.map((post) =>
              post.type === 'facebook' ? (
                <a
                  key={post.id}
                  href={post.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group block"
                >
                  <article className="glass-card flex flex-col gap-6 p-6 transition-shadow duration-300 hover:shadow-xl md:flex-row">
                    {post.imageUrl ? (
                      <img
                        src={post.imageUrl}
                        alt={post.title ?? 'Facebook post'}
                        className="h-48 w-full rounded-xl object-cover transition-transform duration-500 group-hover:scale-105 md:h-40 md:w-48"
                      />
                    ) : (
                      <div className="h-48 w-full rounded-xl bg-gradient-to-br from-blue-600/30 to-blue-400/30 md:h-40 md:w-48" />
                    )}
                    <div className="flex flex-1 flex-col">
                      <div className="flex items-center gap-2">
                        <h3 className="text-xl font-bold transition-colors group-hover:text-neon-blue">
                          {post.title ?? 'Facebook post'}
                        </h3>
                        <span className="rounded-full bg-blue-600/10 px-2 py-0.5 text-xs font-medium text-blue-600">
                          Facebook
                        </span>
                      </div>
                      {post.content ? (
                        <p className="mt-2 line-clamp-2 text-sm text-slate-600 dark:text-slate-400">
                          {summarizeRichText(post.content, 180)}
                        </p>
                      ) : null}
                      <span className="mt-auto inline-block pt-4 text-xs font-medium text-slate-500">
                        {post.publishedAt ? formatDate(post.publishedAt) : ''}
                      </span>
                    </div>
                  </article>
                </a>
              ) : (
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
                        <div className="mt-3 flex flex-wrap gap-1.5">
                          {post.tags.slice(0, 4).map((tag) => (
                            <button
                              key={tag}
                              type="button"
                              onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                navigateToTag(tag);
                              }}
                              className="rounded-full bg-neon-blue/10 px-2 py-0.5 text-xs font-medium text-neon-blue transition-colors hover:bg-neon-blue/20"
                            >
                              {tag}
                            </button>
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
              )
            )
          )}
        </div>
      </div>
    </div>
  );
}

export default function BlogPage() {
  return (
    <Suspense fallback={<div className="min-h-screen" />}>
      <BlogPageContent />
    </Suspense>
  );
}
