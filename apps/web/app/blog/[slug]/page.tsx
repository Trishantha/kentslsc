'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { api } from '@/lib/api';

interface Author {
  id: string;
  name: string;
}

interface BlogPost {
  id: string;
  title: string;
  slug: string;
  content: string;
  imageUrl?: string;
  aiTldr?: string;
  publishedAt: string;
  createdAt: string;
  author: Author;
}

export default function BlogPostPage() {
  const params = useParams();
  const slug = params.slug as string;
  const [post, setPost] = useState<BlogPost | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    api
      .get(`/blog/${slug}`)
      .then((res) => setPost(res.data))
      .catch(() => setError('Failed to load blog post'))
      .finally(() => setLoading(false));
  }, [slug]);

  if (loading) return <p className="px-4 py-16 text-slate-500">Loading...</p>;
  if (error) return <p className="px-4 py-16 text-red-500">{error}</p>;
  if (!post) return null;

  return (
    <div className="px-4 py-16 md:px-6">
      <div className="mx-auto max-w-3xl">
        <article className="glass-card p-8 md:p-12">
          {post.imageUrl ? (
            <img src={post.imageUrl} alt={post.title} className="mb-8 h-64 w-full rounded-xl object-cover" />
          ) : (
            <div className="mb-8 h-64 w-full rounded-xl bg-gradient-to-br from-neon-purple/30 to-neon-blue/30" />
          )}
          <h1 className="section-title">{post.title}</h1>
          <div className="mt-2 flex items-center gap-2 text-sm text-slate-500">
            <span>By {post.author?.name ?? 'Kent SLSC'}</span>
            <span>•</span>
            <span>{new Date(post.publishedAt ?? post.createdAt).toLocaleDateString()}</span>
          </div>

          {post.aiTldr && (
            <div className="mt-6 rounded-xl border border-neon-blue/20 bg-neon-blue/5 p-4 dark:bg-neon-blue/10">
              <p className="text-sm font-semibold text-neon-blue">AI TL;DR</p>
              <p className="mt-1 text-slate-700 dark:text-slate-300">{post.aiTldr}</p>
            </div>
          )}

          <div className="prose prose-slate mt-8 max-w-none dark:prose-invert">
            {post.content.split('\n').map((paragraph, i) => (
              <p key={i} className="mb-4 text-slate-700 dark:text-slate-300">
                {paragraph}
              </p>
            ))}
          </div>
        </article>
      </div>
    </div>
  );
}
