'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { Plus, Loader2, Hash } from 'lucide-react';
import { api } from '@/lib/api';
import { useAuth } from '@/hooks/useAuth';

interface Category {
  id: string;
  name: string;
  description?: string | null;
}

interface LatestTopic {
  id: string;
  title: string;
  createdAt: string;
  user: { name: string };
  _count?: { posts?: number };
}

export default function ForumPage() {
  const { data: user } = useAuth();
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');

  const { data: categories, isLoading, refetch } = useQuery<Category[]>({
    queryKey: ['forum', 'categories'],
    queryFn: async () => {
      const { data } = await api.get('/forum/categories');
      return data;
    }
  });

  const isAdmin = user?.role === 'ADMIN';

  async function handleCreateCategory(e: React.FormEvent) {
    e.preventDefault();
    await api.post('/forum/categories', { name, description });
    setName('');
    setDescription('');
    setShowForm(false);
    refetch();
  }

  if (isLoading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center px-4">
        <Loader2 className="h-8 w-8 animate-spin text-neon-blue" />
      </div>
    );
  }

  return (
    <div className="px-4 py-16 md:px-6">
      <div className="mx-auto max-w-5xl">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="section-title">Community Forum</h1>
            <p className="mt-2 text-slate-600 dark:text-slate-400">
              Join the conversation with fellow members.
            </p>
          </div>
          {isAdmin && (
            <button
              type="button"
              onClick={() => setShowForm((s) => !s)}
              className="btn-secondary inline-flex"
            >
              <Plus className="mr-2 h-4 w-4" />
              {showForm ? 'Cancel' : 'New Category'}
            </button>
          )}
        </div>

        {showForm && (
          <motion.form
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            onSubmit={handleCreateCategory}
            className="mt-6 glass-card p-5"
          >
            <div className="grid gap-4 sm:grid-cols-2">
              <input
                type="text"
                required
                placeholder="Category name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="rounded-xl border border-white/20 bg-white/5 px-4 py-2 text-sm outline-none focus:border-neon-blue"
              />
              <input
                type="text"
                placeholder="Description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="rounded-xl border border-white/20 bg-white/5 px-4 py-2 text-sm outline-none focus:border-neon-blue"
              />
            </div>
            <button type="submit" className="btn-primary mt-4">
              Create Category
            </button>
          </motion.form>
        )}

        <div className="mt-10 grid gap-6 md:grid-cols-2">
          {categories?.map((category) => (
            <CategoryCard key={category.id} category={category} />
          ))}
        </div>
      </div>
    </div>
  );
}

function CategoryCard({ category }: { category: Category }) {
  const { data: topics } = useQuery<LatestTopic[]>({
    queryKey: ['forum', 'category-topics', category.id],
    queryFn: async () => {
      const { data } = await api.get(`/forum/categories/${category.id}/topics`);
      return data.slice(0, 3);
    }
  });

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      className="glass-card overflow-hidden p-6 transition-transform hover:-translate-y-1"
    >
      <Link href={`/forum/categories/${category.id}`}>
        <h2 className="text-xl font-bold hover:text-neon-blue">{category.name}</h2>
      </Link>
      {category.description && (
        <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">{category.description}</p>
      )}

      <div className="mt-5 space-y-3">
        {topics?.map((topic) => (
          <div
            key={topic.id}
            className="flex items-center justify-between rounded-xl border border-white/10 bg-white/5 p-3"
          >
            <div className="min-w-0 flex-1">
              <Link
                href={`/forum/topics/${topic.id}`}
                className="block truncate text-sm font-semibold hover:text-neon-blue"
              >
                {topic.title}
              </Link>
              <p className="mt-1 text-xs text-slate-500">
                {topic.user.name} · {topic._count?.posts ?? 0} replies
              </p>
            </div>
            <Hash className="ml-2 h-4 w-4 shrink-0 text-slate-500" />
          </div>
        ))}
        {topics?.length === 0 && (
          <p className="text-sm text-slate-500">No topics yet. Be the first to start one.</p>
        )}
      </div>
    </motion.div>
  );
}
