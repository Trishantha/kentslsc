'use client';

import { SmartLink } from '@/components/ui/SmartLink';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { ArrowRight } from 'lucide-react';
import { api } from '@/lib/api';
import { formatDate } from '@/lib/utils';
import { summarizeRichText } from '@/lib/rich-text';
import type { BlogBlock, MixedBlogListItem } from '@kentslsc/shared';

interface Props {
  block: BlogBlock;
}

export default function BlogBlockComponent({ block }: Props) {
  const { title, limit = 3 } = block;

  const { data: posts = [], isLoading } = useQuery<MixedBlogListItem[]>({
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
            {posts.slice(0, limit).map((post, index) => {
              const isFacebook = post.type === 'facebook';
              const summary = isFacebook
                ? (post.content ? summarizeRichText(post.content, 160) : 'View the latest post on Facebook.')
                : (post.aiTldr ?? 'Read the latest from our community.');
              const href = isFacebook ? post.url : `/blog/${post.slug}`;
              const linkProps = isFacebook
                ? { href, target: '_blank', rel: 'noopener noreferrer' }
                : { href };
              const LinkComponent = isFacebook ? 'a' : SmartLink;

              return (
                <motion.div
                  key={post.id}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: index * 0.05 }}
                >
                  <LinkComponent {...linkProps} className="group block h-full">
                    <div className="glass-card group h-full overflow-hidden p-0">
                      <div
                        className={`h-40 w-full bg-gradient-to-br ${isFacebook ? 'from-blue-600/40 to-blue-400/40' : 'from-neon-purple/40 to-neon-blue/40'}`}
                        style={post.imageUrl ? { backgroundImage: `url(${post.imageUrl})`, backgroundSize: 'cover' } : undefined}
                      />
                      <div className="p-6">
                        <div className="flex items-center gap-2">
                          <h3 className="text-lg font-bold group-hover:text-neon-blue">{post.title ?? 'Facebook post'}</h3>
                          {isFacebook && (
                            <span className="rounded-full bg-blue-600/10 px-2 py-0.5 text-xs font-medium text-blue-600">
                              Facebook
                            </span>
                          )}
                        </div>
                        <p className="mt-2 line-clamp-3 text-sm text-slate-700 dark:text-slate-400">
                          {summary}
                        </p>
                        {post.publishedAt && (
                          <p className="mt-4 text-xs text-slate-600 dark:text-slate-400">{formatDate(post.publishedAt)}</p>
                        )}
                      </div>
                    </div>
                  </LinkComponent>
                </motion.div>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}
