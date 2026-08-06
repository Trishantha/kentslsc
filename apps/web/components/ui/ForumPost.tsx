'use client';

import { motion } from 'framer-motion';
import { User } from 'lucide-react';

export interface ForumPostProps {
  post: {
    id: string;
    content: string;
    isFlagged: boolean;
    createdAt: string;
    user: { id: string; name: string };
  };
  isAuthor?: boolean;
  onDelete?: () => void;
}

export function ForumPost({ post, isAuthor, onDelete }: ForumPostProps) {
  return (
    <motion.div
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      className="glass-card p-4"
    >
      <div className="flex items-start gap-3">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-neon-blue/10 text-neon-blue">
          <User className="h-4 w-4" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <span className="font-semibold text-sm">{post.user.name}</span>
            <span className="text-xs text-slate-500">
              {new Date(post.createdAt).toLocaleString('en-GB')}
            </span>
          </div>
          <p className="mt-1 whitespace-pre-wrap text-sm text-slate-700 dark:text-slate-300">
            {post.content}
          </p>
          {post.isFlagged && (
            <p className="mt-2 text-xs font-medium text-red-500">
              This post was flagged by automated moderation.
            </p>
          )}
        </div>
      </div>
      {isAuthor && onDelete && (
        <div className="mt-3 flex justify-end">
          <button
            type="button"
            onClick={onDelete}
            className="text-xs font-medium text-red-500 hover:text-red-400"
          >
            Delete
          </button>
        </div>
      )}
    </motion.div>
  );
}
