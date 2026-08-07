'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';
import { formatDate } from '@/lib/utils';

interface BlogPost {
  id: string;
  title: string;
  slug: string;
  imageUrl?: string;
  aiTldr?: string;
  publishedAt: string;
  createdAt: string;
}

export default function BlogPage() {
  const [posts, setPosts] = useState<BlogPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    api
      .get('/blog')
      .then((res) => setPosts(res.data))
      .catch(() => setError('Failed to load blog posts'))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="px-4 py-16 md:px-6">
      <div className="mx-auto max-w-5xl">
        <h1 className="section-title">Blog</h1>
        <p className="mt-4 text-slate-600 dark:text-slate-400">Latest news, stories, and community updates.</p>

        {loading && <p className="mt-10 text-slate-500">Loading...</p>}
        {error && <p className="mt-10 text-red-500">{error}</p>}

        <div className="mt-10 space-y-6">
          {posts.map((post) => (
            <Link key={post.id} href={`/blog/${post.slug}`}>
              <article className="glass-card flex flex-col gap-6 p-6 transition-transform hover:scale-[1.01] md:flex-row">
                {post.imageUrl ? (
                  <img
                    src={post.imageUrl}
                    alt={post.title}
                    className="h-40 w-full rounded-xl object-cover md:w-48"
                  />
                ) : (
                  <div className="h-40 w-full rounded-xl bg-gradient-to-br from-neon-purple/30 to-neon-blue/30 md:w-48" />
                )}
                <div className="flex-1">
                  <h3 className="text-xl font-bold">{post.title}</h3>
                  {post.aiTldr ? (
                    <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">{post.aiTldr}</p>
                  ) : null}
                  <span className="mt-4 inline-block text-xs text-slate-500">
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
