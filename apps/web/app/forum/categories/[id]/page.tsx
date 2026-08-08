'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { Plus, Loader2, ArrowLeft, Lock } from 'lucide-react';
import { api } from '@/lib/api';
import { useAuth } from '@/hooks/useAuth';
import { FeatureGate } from '@/components/ui/FeatureGate';
import { ForumTopicCard } from '@/components/ui/ForumTopicCard';
import { MembershipFeature } from '@kentslsc/shared';

interface Category {
  id: string;
  name: string;
  description?: string | null;
}

interface Topic {
  id: string;
  title: string;
  content: string;
  aiSummary?: string | null;
  tags: string[];
  isFlagged: boolean;
  createdAt: string;
  user: { id: string; name: string };
  _count?: { posts?: number };
}

export default function CategoryPage() {
  const params = useParams<{ id: string }>();
  const { data: user } = useAuth();
  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');

  const categoryId = params?.id;

  const { data: category, isLoading: categoryLoading } = useQuery<Category>({
    queryKey: ['forum', 'category', categoryId],
    queryFn: async () => {
      const { data } = await api.get(`/forum/categories/${categoryId}`);
      return data;
    }
  });

  const { data: topics, isLoading, refetch } = useQuery<Topic[]>({
    queryKey: ['forum', 'category-topics', categoryId],
    queryFn: async () => {
      const { data } = await api.get(`/forum/categories/${categoryId}/topics`);
      return data;
    }
  });

  async function handleCreateTopic(e: React.FormEvent) {
    e.preventDefault();
    await api.post(`/forum/categories/${categoryId}/topics`, { categoryId, title, content });
    setTitle('');
    setContent('');
    setShowForm(false);
    refetch();
  }

  if (categoryLoading || isLoading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center px-4">
        <Loader2 className="h-8 w-8 animate-spin text-neon-blue" />
      </div>
    );
  }

  return (
    <div className="px-4 py-16 md:px-6">
      <div className="mx-auto max-w-5xl">
        <Link
          href="/forum"
          className="mb-4 inline-flex items-center text-sm text-slate-500 hover:text-neon-blue"
        >
          <ArrowLeft className="mr-1 h-4 w-4" />
          Back to Forum
        </Link>

        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="section-title">{category?.name ?? 'Category'}</h1>
            {category?.description && (
              <p className="mt-2 text-slate-600 dark:text-slate-400">{category.description}</p>
            )}
          </div>
          {user && (
            <FeatureGate
              feature={MembershipFeature.FORUM_POST}
              fallback={
                <div className="rounded-xl border border-neon-gold/20 bg-neon-gold/5 px-4 py-2 text-sm text-slate-600 dark:text-slate-400">
                  <Lock className="mr-1 inline h-3 w-3 text-neon-gold" />
                  Posting requires a full membership
                </div>
              }
            >
              <button
                type="button"
                onClick={() => setShowForm((s) => !s)}
                className="btn-secondary inline-flex"
              >
                <Plus className="mr-2 h-4 w-4" />
                {showForm ? 'Cancel' : 'New Topic'}
              </button>
            </FeatureGate>
          )}
        </div>

        {showForm && user && (
          <motion.form
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            onSubmit={handleCreateTopic}
            className="mt-6 glass-card space-y-4 p-5"
          >
            <input
              type="text"
              required
              placeholder="Topic title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full rounded-xl border border-white/20 bg-white/5 px-4 py-2 text-sm outline-none focus:border-neon-blue"
            />
            <textarea
              required
              rows={4}
              placeholder="What's on your mind?"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              className="w-full rounded-xl border border-white/20 bg-white/5 px-4 py-2 text-sm outline-none focus:border-neon-blue"
            />
            <button type="submit" className="btn-primary">
              Start Topic
            </button>
          </motion.form>
        )}

        <div className="mt-10 space-y-4">
          {topics?.map((topic) => (
            <ForumTopicCard
              key={topic.id}
              topic={topic}
              href={`/forum/topics/${topic.id}`}
            />
          ))}
          {topics?.length === 0 && (
            <p className="text-center text-slate-500">No topics in this category yet.</p>
          )}
        </div>
      </div>
    </div>
  );
}
