'use client';

import { SmartLink } from '@/components/ui/SmartLink';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { ArrowRight } from 'lucide-react';
import { api } from '@/lib/api';
import { formatDate } from '@/lib/utils';
import type { BlogBlock } from '@kentslsc/shared';

interface Props {
  block: BlogBlock;
}

interface BlogPostItem {
  id: string;
  title: string;
  slug: string;
  imageUrl?: string;
  aiTldr?: string;
  publishedAt?: string;
}

export default function BlogBlockComponent({ block }: Props) {
  const { title, limit = 3 } = block;

  const { data: posts = [], isLoading } = useQuery<BlogPostItem[]>({
    queryKey: ['blocks', 'blog', limit],
    queryFn: async () => {
      const { data } = await api.get('/blog', { params: { limit } });
      return data ?? [];
    }
  });

  return (
    <section className="px-4 py-16 md:px-6">
      <div className="mx-auto max-w-7xl">
        <div className="mb-8 flex items-end justify-between">
          <div>{title && <h2 className="section-title">{title}</h2>}</div>
          <SmartLink href="/blog" className="hidden text-sm font-semibold text-neon-blue sm:inline-flex">
            Read all <ArrowRight className="ml-1 h-4 w-4" />
          </SmartLink>
        </div>

        {isLoading ? (
          <div className="grid gap-6 md:grid-cols-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="glass-card h-64 animate-pulse" />
            ))}
          </div>
        ) : posts.length === 0 ? (
          <p className="text-slate-600 dark:text-slate-400">No blog posts yet.</p>
        ) : (
          <div className="grid gap-6 md:grid-cols-3">
            {posts.slice(0, limit).map((post, index) => (
              <motion.div
                key={post.id}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.05 }}
              >
                <SmartLink href={`/blog/${post.slug}`}>
                  <div className="glass-card group h-full overflow-hidden p-0">
                    <div
                      className="h-40 w-full bg-gradient-to-br from-neon-purple/40 to-neon-blue/40"
                      style={post.imageUrl ? { backgroundImage: `url(${post.imageUrl})`, backgroundSize: 'cover' } : undefined}
                    />
                    <div className="p-6">
                      <h3 className="text-lg font-bold group-hover:text-neon-blue">{post.title}</h3>
                      <p className="mt-2 line-clamp-3 text-sm text-slate-700 dark:text-slate-400">
                        {post.aiTldr ?? 'Read the latest from our community.'}
                      </p>
                      {post.publishedAt && (
                        <p className="mt-4 text-xs text-slate-600 dark:text-slate-400">{formatDate(post.publishedAt)}</p>
                      )}
                    </div>
                  </div>
                </SmartLink>
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
