'use client';

import Link from 'next/link';
import { motion } from 'framer-motion';
import { MessageSquare, User } from 'lucide-react';
import { formatDate } from '@/lib/utils';

export interface ForumTopicCardProps {
  topic: {
    id: string;
    title: string;
    content: string;
    aiSummary?: string | null;
    tags: string[];
    isFlagged: boolean;
    createdAt: string;
    user: { id: string; name: string };
    _count?: { posts?: number };
  };
  href?: string;
}

export function ForumTopicCard({ topic, href }: ForumTopicCardProps) {
  const content = topic.aiSummary || topic.content.slice(0, 140);
  const postCount = topic._count?.posts ?? 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="glass-card overflow-hidden p-5 transition-transform hover:-translate-y-1"
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1">
          {href ? (
            <Link href={href} className="group">
              <h3 className="text-lg font-bold group-hover:text-neon-blue">{topic.title}</h3>
            </Link>
          ) : (
            <h3 className="text-lg font-bold">{topic.title}</h3>
          )}
          <p className="mt-2 line-clamp-2 text-sm text-slate-600 dark:text-slate-400">{content}</p>
        </div>
        {topic.isFlagged && (
          <span className="shrink-0 rounded-full bg-red-500/10 px-2 py-1 text-xs font-semibold text-red-600 dark:text-red-400">
            Flagged
          </span>
        )}
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-3 text-xs text-slate-500 dark:text-slate-500">
        <span className="flex items-center gap-1">
          <User className="h-3.5 w-3.5" />
          {topic.user.name}
        </span>
        <span className="flex items-center gap-1">
          <MessageSquare className="h-3.5 w-3.5" />
          {postCount} {postCount === 1 ? 'post' : 'posts'}
        </span>
        <span>{formatDate(topic.createdAt)}</span>
      </div>

      {topic.tags.length > 0 && (
        <div className="mt-4 flex flex-wrap gap-2">
          {topic.tags.map((tag) => (
            <span
              key={tag}
              className="rounded-full border border-neon-blue/30 bg-neon-blue/10 px-2 py-0.5 text-xs text-neon-blue"
            >
              {tag}
            </span>
          ))}
        </div>
      )}
    </motion.div>
  );
}
