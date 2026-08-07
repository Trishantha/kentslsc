'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import { Loader2, Send, ArrowLeft, Trash2, Hash } from 'lucide-react';
import Link from 'next/link';
import { api } from '@/lib/api';
import { useAuth } from '@/hooks/useAuth';
import { useForumSocket } from '@/hooks/useForumSocket';
import { useHasFeature } from '@/hooks/useFeatures';
import { FeatureGate } from '@/components/ui/FeatureGate';
import { ForumPost } from '@/components/ui/ForumPost';
import { ForumTopicCard } from '@/components/ui/ForumTopicCard';
import { MembershipFeature } from '@kentslsc/shared';

interface Topic {
  id: string;
  title: string;
  content: string;
  aiSummary?: string | null;
  tags: string[];
  isFlagged: boolean;
  createdAt: string;
  user: { id: string; name: string };
  category: { id: string; name: string };
}

interface Post {
  id: string;
  content: string;
  isFlagged: boolean;
  createdAt: string;
  user: { id: string; name: string };
}

export default function TopicPage() {
  const params = useParams<{ id: string }>();
  const topicId = params.id;
  const { data: user } = useAuth();
  const bottomRef = useRef<HTMLDivElement | null>(null);

  const [posts, setPosts] = useState<Post[]>([]);
  const [input, setInput] = useState('');

  const { data: topic, isLoading: topicLoading } = useQuery<Topic>({
    queryKey: ['forum', 'topic', topicId],
    queryFn: async () => {
      const { data } = await api.get(`/forum/topics/${topicId}`);
      return data;
    }
  });

  const { data: initialPosts, isLoading: postsLoading } = useQuery<Post[]>({
    queryKey: ['forum', 'topic-posts', topicId],
    queryFn: async () => {
      const { data } = await api.get(`/forum/topics/${topicId}/posts`);
      return data;
    }
  });

  useEffect(() => {
    if (initialPosts) {
      setPosts(initialPosts);
    }
  }, [initialPosts]);

  const handleNewPost = useCallback((post: unknown) => {
    setPosts((prev) => {
      const p = post as Post;
      if (prev.some((x) => x.id === p.id)) return prev;
      return [...prev, p];
    });
  }, []);

  const { connected, error, sendPost } = useForumSocket(topicId, handleNewPost);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [posts]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!input.trim() || !user) return;
    const ok = sendPost(input.trim());
    if (ok) {
      setInput('');
    } else {
      await api.post(`/forum/topics/${topicId}/posts`, { topicId, content: input.trim() });
      setInput('');
    }
  }

  async function deletePost(postId: string) {
    await api.delete(`/forum/posts/${postId}`);
    setPosts((prev) => prev.filter((p) => p.id !== postId));
  }

  async function deleteTopic() {
    await api.delete(`/forum/topics/${topicId}`);
    window.location.href = `/forum/categories/${topic?.category.id}`;
  }

  if (topicLoading || postsLoading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center px-4">
        <Loader2 className="h-8 w-8 animate-spin text-neon-blue" />
      </div>
    );
  }

  if (!topic) return null;

  const isAuthor = user?.id === topic.user.id;
  const isAdmin = user?.role === 'ADMIN';

  return (
    <div className="px-4 py-16 md:px-6">
      <div className="mx-auto max-w-4xl">
        <Link
          href={`/forum/categories/${topic.category.id}`}
          className="mb-4 inline-flex items-center text-sm text-slate-500 hover:text-neon-blue"
        >
          <ArrowLeft className="mr-1 h-4 w-4" />
          Back to {topic.category.name}
        </Link>

        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
          <ForumTopicCard topic={topic} />
        </motion.div>

        {(isAuthor || isAdmin) && (
          <div className="mt-4 flex justify-end">
            <button
              type="button"
              onClick={deleteTopic}
              className="inline-flex items-center text-sm font-medium text-red-500 hover:text-red-400"
            >
              <Trash2 className="mr-1 h-4 w-4" />
              Delete Topic
            </button>
          </div>
        )}

        <div className="mt-8">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold">Discussion</h2>
            <span
              className={`inline-flex h-2 w-2 rounded-full ${
                connected ? 'bg-green-500' : 'bg-yellow-500'
              }`}
              title={connected ? 'Live' : 'Reconnecting'}
            />
          </div>

          {error && (
            <div className="mt-3 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-2 text-sm text-red-600 dark:text-red-400">
              {error}
            </div>
          )}

          <div className="mt-4 space-y-3">
            <AnimatePresence>
              {posts.map((post) => (
                <ForumPost
                  key={post.id}
                  post={post}
                  isAuthor={user?.id === post.user.id || isAdmin}
                  onDelete={
                    user?.id === post.user.id || isAdmin
                      ? () => deletePost(post.id)
                      : undefined
                  }
                />
              ))}
            </AnimatePresence>
            <div ref={bottomRef} />
          </div>

          {user ? (
            <FeatureGate
              feature={MembershipFeature.FORUM_POST}
              fallback={
                <div className="mt-6 rounded-xl border border-neon-gold/20 bg-neon-gold/5 p-6 text-center text-sm text-slate-600 dark:text-slate-400">
                  Your current membership allows you to read the forum. Upgrade to a full membership to reply and start topics.
                </div>
              }
            >
              <form onSubmit={handleSubmit} className="mt-6 glass-card p-4">
                <div className="flex gap-3">
                  <input
                    type="text"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    placeholder="Write a reply..."
                    className="flex-1 rounded-xl border border-white/20 bg-white/5 px-4 py-2 text-sm outline-none focus:border-neon-blue"
                  />
                  <button
                    type="submit"
                    disabled={!input.trim()}
                    className="btn-primary inline-flex disabled:opacity-50"
                  >
                    <Send className="h-4 w-4" />
                  </button>
                </div>
              </form>
            </FeatureGate>
          ) : (
            <div className="mt-6 rounded-xl border border-white/20 bg-white/5 p-6 text-center text-sm text-slate-500">
              Please log in to join the conversation.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
