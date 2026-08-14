'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { Loader2, Trash2, MessageSquareWarning } from 'lucide-react';
import { api } from '@/lib/api';
import { AdminListLayout } from '@/components/admin/AdminListLayout';

interface ForumTopic {
  id: string;
  title: string;
  content: string;
  createdAt: string;
  user: { id: string; name: string };
  category: { name: string };
}

interface ForumPost {
  id: string;
  content: string;
  createdAt: string;
  user: { id: string; name: string };
  topic: { id: string; title: string };
}

interface FlaggedData {
  topics: ForumTopic[];
  posts: ForumPost[];
}

export default function AdminForumPage() {
  const queryClient = useQueryClient();
  const { data, isLoading } = useQuery<FlaggedData>({
    queryKey: ['admin', 'forum', 'flagged'],
    queryFn: async () => {
      const res = await api.get('/admin/forum/flagged');
      return res.data;
    }
  });

  const deleteTopic = useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/admin/forum/topics/${id}`);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin', 'forum', 'flagged'] })
  });

  const deletePost = useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/admin/forum/posts/${id}`);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin', 'forum', 'flagged'] })
  });

  const topicCount = data?.topics.length ?? 0;
  const postCount = data?.posts.length ?? 0;

  return (
    <AdminListLayout
      title="Forum Moderation"
      description="Review and remove flagged topics and posts."
    >
      <div className="mb-6 grid gap-4 sm:grid-cols-2">
        <div className="glass-card flex items-center gap-3 p-4">
          <MessageSquareWarning className="h-6 w-6 text-red-400" />
          <div>
            <p className="text-2xl font-bold">{topicCount}</p>
            <p className="text-xs text-slate-500">Flagged topics</p>
          </div>
        </div>
        <div className="glass-card flex items-center gap-3 p-4">
          <MessageSquareWarning className="h-6 w-6 text-amber-400" />
          <div>
            <p className="text-2xl font-bold">{postCount}</p>
            <p className="text-xs text-slate-500">Flagged posts</p>
          </div>
        </div>
      </div>

      <div className="space-y-6">
        {isLoading ? (
          <div className="flex h-40 items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-neon-blue" />
          </div>
        ) : (
          <>
            <div className="glass-card p-6">
              <h2 className="mb-4 text-lg font-bold">Flagged Topics</h2>
              {data?.topics.length ? (
                <div className="space-y-3">
                  {data.topics.map((topic, idx) => (
                    <motion.div
                      key={topic.id}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: idx * 0.05 }}
                      className="rounded-xl border border-white/10 bg-white/5 p-4"
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <div className="flex items-center gap-2">
                            <MessageSquareWarning className="h-4 w-4 text-red-400" />
                            <span className="font-semibold">{topic.title}</span>
                          </div>
                          <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">{topic.content}</p>
                          <div className="mt-2 text-xs text-slate-500">
                            by {topic.user.name} in {topic.category.name} · {new Date(topic.createdAt).toLocaleString('en-GB')}
                          </div>
                        </div>
                        <button
                          onClick={() => deleteTopic.mutate(topic.id)}
                          className="rounded-lg bg-red-500/10 p-2 text-red-400 hover:bg-red-500/20"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </motion.div>
                  ))}
                </div>
              ) : (
                <div className="text-center text-slate-500">No flagged topics.</div>
              )}
            </div>

            <div className="glass-card p-6">
              <h2 className="mb-4 text-lg font-bold">Flagged Posts</h2>
              {data?.posts.length ? (
                <div className="space-y-3">
                  {data.posts.map((post, idx) => (
                    <motion.div
                      key={post.id}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: idx * 0.05 }}
                      className="rounded-xl border border-white/10 bg-white/5 p-4"
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <p className="text-sm text-slate-600 dark:text-slate-400">{post.content}</p>
                          <div className="mt-2 text-xs text-slate-500">
                            by {post.user.name} in {post.topic.title} · {new Date(post.createdAt).toLocaleString('en-GB')}
                          </div>
                        </div>
                        <button
                          onClick={() => deletePost.mutate(post.id)}
                          className="rounded-lg bg-red-500/10 p-2 text-red-400 hover:bg-red-500/20"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </motion.div>
                  ))}
                </div>
              ) : (
                <div className="text-center text-slate-500">No flagged posts.</div>
              )}
            </div>
          </>
        )}
      </div>
    </AdminListLayout>
  );
}
