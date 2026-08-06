'use client';

import { useState } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { useQuery } from '@tanstack/react-query';
import {
  Calendar,
  Heart,
  Briefcase,
  Users,
  Sparkles,
  ChevronLeft,
  ChevronRight,
  MessageSquare,
  ArrowRight,
  Loader2
} from 'lucide-react';
import { api } from '@/lib/api';
import { useAuth } from '@/hooks/useAuth';
import BlockRenderer from '@/components/blocks/BlockRenderer';
import type { PageBlock } from '@kentslsc/shared';

interface EventItem {
  id: string;
  title: string;
  description?: string | null;
  location?: string | null;
  startDatetime: string;
  endDatetime: string;
  imageUrl?: string | null;
  ticketPrice: number | string;
}

interface FundraiserItem {
  id: string;
  title: string;
  description?: string | null;
  targetAmount: number;
  raisedAmount: number;
  imageUrl?: string | null;
}

interface BusinessItem {
  id: string;
  businessName: string;
  description?: string | null;
  logoUrl?: string | null;
  category?: string | null;
  isPromoted?: boolean;
}

interface BlogPostItem {
  id: string;
  title: string;
  slug: string;
  imageUrl?: string | null;
  aiTldr?: string | null;
  publishedAt?: string | null;
}

interface ForumTopicItem {
  id: string;
  title: string;
  content: string;
  createdAt: string;
  user?: { name: string };
  category?: { name: string };
  _count?: { posts: number };
}

function formatDate(date: string | Date) {
  return new Date(date).toLocaleDateString('en-GB', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric'
  });
}

function formatCurrency(value: number | string) {
  const num = typeof value === 'string' ? Number(value) : value;
  return new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' }).format(num ?? 0);
}

const container = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.1 }
  }
};

const item = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0 }
};

function HomePageContent() {
  const { data: user } = useAuth();

  const { data: recommendedEvents = [], isLoading: eventsLoading } = useQuery<EventItem[]>({
    queryKey: ['ai', 'recommend', 'events', user?.id ?? 'anonymous'],
    queryFn: async () => {
      const { data } = await api.post('/ai/recommend', {
        type: 'events',
        ...(user?.id && { userId: user.id }),
        limit: 3
      });
      return data.items ?? [];
    }
  });

  const { data: fundraisers = [], isLoading: fundraisersLoading } = useQuery<FundraiserItem[]>({
    queryKey: ['fundraisers'],
    queryFn: async () => {
      const { data } = await api.get('/fundraisers');
      return data ?? [];
    }
  });

  const { data: promotedBusinesses = [], isLoading: businessesLoading } = useQuery<BusinessItem[]>({
    queryKey: ['directory', 'businesses', 'promoted'],
    queryFn: async () => {
      const { data } = await api.get('/directory/businesses?promoted=true');
      return data ?? [];
    }
  });

  const { data: blogPosts = [], isLoading: blogLoading } = useQuery<BlogPostItem[]>({
    queryKey: ['blog', 'latest'],
    queryFn: async () => {
      const { data } = await api.get('/blog');
      return data ?? [];
    }
  });

  const { data: recentTopics = [], isLoading: topicsLoading } = useQuery<ForumTopicItem[]>({
    queryKey: ['forum', 'topics', 'recent'],
    queryFn: async () => {
      const { data } = await api.get('/forum/topics/recent');
      return data ?? [];
    }
  });

  const featuredFundraiser = fundraisers[0];
  const progress = featuredFundraiser
    ? Math.min(100, Math.round((featuredFundraiser.raisedAmount / featuredFundraiser.targetAmount) * 100))
    : 0;

  const [businessIndex, setBusinessIndex] = useState(0);
  const businessesPerPage = 3;
  const maxBusinessIndex = Math.max(0, promotedBusinesses.length - businessesPerPage);

  const nextBusinesses = () => setBusinessIndex((i) => Math.min(i + 1, maxBusinessIndex));
  const prevBusinesses = () => setBusinessIndex((i) => Math.max(i - 1, 0));

  return (
    <div className="relative overflow-hidden">
      {/* Animated background blobs */}
      <div className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
        <motion.div
          animate={{ x: [0, 30, 0], y: [0, -20, 0] }}
          transition={{ duration: 8, repeat: Infinity, ease: 'easeInOut' }}
          className="absolute -left-20 top-20 h-72 w-72 rounded-full bg-neon-blue/20 blur-3xl"
        />
        <motion.div
          animate={{ x: [0, -20, 0], y: [0, 30, 0] }}
          transition={{ duration: 10, repeat: Infinity, ease: 'easeInOut' }}
          className="absolute bottom-20 right-0 h-96 w-96 rounded-full bg-neon-gold/20 blur-3xl"
        />
        <motion.div
          animate={{ x: [0, 20, 0], y: [0, 20, 0] }}
          transition={{ duration: 12, repeat: Infinity, ease: 'easeInOut' }}
          className="absolute left-1/3 top-1/2 h-64 w-64 rounded-full bg-neon-purple/20 blur-3xl"
        />
      </div>

      <section className="relative px-4 pb-20 pt-24 md:px-6 md:pt-36">
        <div className="mx-auto max-w-5xl text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
          >
            <span className="inline-flex items-center gap-2 rounded-full border border-neon-blue/30 bg-neon-blue/10 px-4 py-1.5 text-sm font-medium text-neon-blue">
              <Sparkles className="h-4 w-4" /> AI-Driven Community Platform
            </span>
          </motion.div>
          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.1 }}
            className="mt-6 text-5xl font-extrabold leading-tight tracking-tight md:text-7xl"
          >
            Kent <span className="gradient-text">Sri Lankan</span>
            <br /> Social Club
          </motion.h1>
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="mx-auto mt-6 max-w-2xl text-lg text-slate-600 dark:text-slate-300"
          >
            Connecting the Sri Lankan community in Kent through events, culture,
            business, and fellowship. Join us and be part of something extraordinary.
          </motion.p>
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.3 }}
            className="mt-8 flex flex-col items-center justify-center gap-4 sm:flex-row"
          >
            <Link href="/membership" className="btn-primary">
              Become a Member
            </Link>
            <Link href="/events" className="btn-secondary">
              Explore Events
            </Link>
          </motion.div>
        </div>
      </section>

      <section className="px-4 py-16 md:px-6">
        <div className="mx-auto max-w-7xl">
          <h2 className="section-title text-center">Discover What We Offer</h2>
          <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {[
              { icon: Calendar, title: 'Events', desc: 'Cultural gatherings, dinners, and family activities.', href: '/events' },
              { icon: Heart, title: 'Fundraising', desc: 'Support causes that matter to our community.', href: '/fundraisers' },
              { icon: Briefcase, title: 'Directory', desc: 'Find Sri Lankan businesses and job opportunities.', href: '/directory' },
              { icon: Users, title: 'Membership', desc: 'Join as a member and unlock exclusive benefits.', href: '/membership' }
            ].map((feature) => (
              <Link key={feature.title} href={feature.href}>
                <motion.div
                  whileHover={{ y: -6 }}
                  className="glass-card h-full p-6 hover:shadow-neon"
                >
                  <feature.icon className="h-8 w-8 text-neon-blue" />
                  <h3 className="mt-4 text-xl font-bold">{feature.title}</h3>
                  <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">{feature.desc}</p>
                </motion.div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      <section className="px-4 py-16 md:px-6">
        <div className="mx-auto max-w-7xl">
          <div className="grid gap-8 lg:grid-cols-2">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="glass-card p-8"
            >
              <div className="flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-neon-gold" />
                <h3 className="text-2xl font-bold">AI-Recommended Events</h3>
              </div>
              <p className="mt-2 text-slate-600 dark:text-slate-400">
                {user ? 'Events tailored to your profile and interests.' : 'Log in to see events tailored to your profile and interests.'}
              </p>
              <div className="mt-6 space-y-4">
                {eventsLoading ? (
                  <>
                    {[1, 2, 3].map((i) => (
                      <div key={i} className="flex animate-pulse items-center gap-4 rounded-xl bg-white/5 p-4">
                        <div className="h-12 w-12 rounded-lg bg-slate-300 dark:bg-slate-700" />
                        <div className="flex-1 space-y-2">
                          <div className="h-4 w-3/4 rounded bg-slate-300 dark:bg-slate-700" />
                          <div className="h-3 w-1/2 rounded bg-slate-300 dark:bg-slate-700" />
                        </div>
                      </div>
                    ))}
                  </>
                ) : recommendedEvents.length === 0 ? (
                  <p className="text-sm text-slate-500">No upcoming events right now. Check back soon!</p>
                ) : (
                  recommendedEvents.map((evt) => (
                    <Link key={evt.id} href={`/events/${evt.id}`}>
                      <motion.div
                        whileHover={{ x: 4 }}
                        className="flex items-center gap-4 rounded-xl bg-white/5 p-4 transition-colors hover:bg-white/10"
                      >
                        <div
                          className="h-12 w-12 flex-shrink-0 rounded-lg bg-gradient-to-br from-neon-blue to-neon-gold"
                          style={evt.imageUrl ? { backgroundImage: `url(${evt.imageUrl})`, backgroundSize: 'cover' } : undefined}
                        />
                        <div className="min-w-0">
                          <p className="truncate font-semibold">{evt.title}</p>
                          <p className="text-sm text-slate-500">
                            {formatDate(evt.startDatetime)} • {evt.location ?? 'TBC'}
                          </p>
                        </div>
                      </motion.div>
                    </Link>
                  ))
                )}
              </div>
              <Link href="/events" className="btn-secondary mt-6 inline-flex">
                View all events
              </Link>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.1 }}
              className="glass-card p-8"
            >
              <div className="flex items-center gap-2">
                <Heart className="h-5 w-5 text-rose-500" />
                <h3 className="text-2xl font-bold">Featured Fundraiser</h3>
              </div>
              <p className="mt-2 text-slate-600 dark:text-slate-400">
                Help us reach our next goal and make a lasting impact.
              </p>
              {fundraisersLoading ? (
                <div className="mt-6 animate-pulse space-y-4">
                  <div className="h-6 w-3/4 rounded bg-slate-300 dark:bg-slate-700" />
                  <div className="h-4 w-full rounded-full bg-slate-300 dark:bg-slate-700" />
                  <div className="h-4 w-1/2 rounded bg-slate-300 dark:bg-slate-700" />
                </div>
              ) : !featuredFundraiser ? (
                <p className="mt-6 text-sm text-slate-500">No active fundraisers at the moment.</p>
              ) : (
                <div className="mt-6">
                  <h4 className="text-xl font-semibold">{featuredFundraiser.title}</h4>
                  <p className="mt-1 line-clamp-2 text-sm text-slate-500">{featuredFundraiser.description}</p>
                  <div className="mt-4 h-4 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700">
                    <motion.div
                      initial={{ width: 0 }}
                      whileInView={{ width: `${progress}%` }}
                      viewport={{ once: true }}
                      transition={{ duration: 1 }}
                      className="h-full bg-gradient-to-r from-neon-blue to-neon-gold"
                    />
                  </div>
                  <div className="mt-2 flex justify-between text-sm">
                    <span>{formatCurrency(featuredFundraiser.raisedAmount)} raised</span>
                    <span>Goal: {formatCurrency(featuredFundraiser.targetAmount)}</span>
                  </div>
                  <Link href={`/fundraisers/${featuredFundraiser.id}`} className="btn-primary mt-6 inline-block">
                    Donate Now
                  </Link>
                </div>
              )}
            </motion.div>
          </div>
        </div>
      </section>

      {/* Promoted businesses carousel */}
      <section className="px-4 py-16 md:px-6">
        <div className="mx-auto max-w-7xl">
          <div className="mb-8 flex items-center justify-between">
            <div>
              <h2 className="section-title">Promoted Businesses</h2>
              <p className="mt-2 text-slate-600 dark:text-slate-400">Support Sri Lankan businesses in Kent.</p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={prevBusinesses}
                disabled={businessIndex === 0}
                className="rounded-full border border-white/20 p-2 transition-colors hover:bg-white/10 disabled:opacity-30"
                aria-label="Previous"
              >
                <ChevronLeft className="h-5 w-5" />
              </button>
              <button
                onClick={nextBusinesses}
                disabled={businessIndex >= maxBusinessIndex}
                className="rounded-full border border-white/20 p-2 transition-colors hover:bg-white/10 disabled:opacity-30"
                aria-label="Next"
              >
                <ChevronRight className="h-5 w-5" />
              </button>
            </div>
          </div>

          {businessesLoading ? (
            <div className="grid gap-6 md:grid-cols-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="glass-card h-48 animate-pulse p-6" />
              ))}
            </div>
          ) : promotedBusinesses.length === 0 ? (
            <p className="text-slate-500">No promoted businesses right now.</p>
          ) : (
            <div className="overflow-hidden">
              <motion.div
                className="flex gap-6"
                animate={{ x: `-${businessIndex * (100 / businessesPerPage)}%` }}
                transition={{ type: 'spring', stiffness: 300, damping: 30 }}
              >
                {promotedBusinesses.map((business) => (
                  <div
                    key={business.id}
                    className="glass-card flex w-full flex-shrink-0 flex-col p-6 md:w-[calc(33.333%-1rem)]"
                  >
                    <div className="flex items-start justify-between">
                      <div
                        className="h-14 w-14 rounded-xl bg-gradient-to-br from-neon-gold to-amber-500"
                        style={business.logoUrl ? { backgroundImage: `url(${business.logoUrl})`, backgroundSize: 'cover' } : undefined}
                      />
                      <span className="rounded-full bg-neon-gold/10 px-2 py-1 text-xs font-medium text-amber-700 dark:text-neon-gold">
                        Promoted
                      </span>
                    </div>
                    <h3 className="mt-4 text-lg font-bold">{business.businessName}</h3>
                    <p className="mt-1 line-clamp-2 flex-1 text-sm text-slate-600 dark:text-slate-400">
                      {business.description ?? business.category ?? 'Sri Lankan business in Kent'}
                    </p>
                    <Link href={`/directory/${business.id}`} className="mt-4 inline-flex items-center text-sm font-semibold text-neon-blue">
                      View listing <ArrowRight className="ml-1 h-4 w-4" />
                    </Link>
                  </div>
                ))}
              </motion.div>
            </div>
          )}
        </div>
      </section>

      {/* Latest blog posts */}
      <section className="px-4 py-16 md:px-6">
        <div className="mx-auto max-w-7xl">
          <div className="mb-8 flex items-end justify-between">
            <div>
              <h2 className="section-title">Latest Blog Posts</h2>
              <p className="mt-2 text-slate-600 dark:text-slate-400">Stories, updates, and community voices.</p>
            </div>
            <Link href="/blog" className="hidden text-sm font-semibold text-neon-blue sm:inline-flex">
              Read all posts <ArrowRight className="ml-1 h-4 w-4" />
            </Link>
          </div>

          {blogLoading ? (
            <div className="grid gap-6 md:grid-cols-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="glass-card h-64 animate-pulse p-0" />
              ))}
            </div>
          ) : blogPosts.length === 0 ? (
            <p className="text-slate-500">No blog posts yet.</p>
          ) : (
            <motion.div
              variants={container}
              initial="hidden"
              whileInView="show"
              viewport={{ once: true }}
              className="grid gap-6 md:grid-cols-3"
            >
              {blogPosts.slice(0, 3).map((post) => (
                <motion.div key={post.id} variants={item}>
                  <Link href={`/blog/${post.slug}`}>
                    <div className="glass-card group h-full overflow-hidden p-0">
                      <div
                        className="h-40 w-full bg-gradient-to-br from-neon-purple/40 to-neon-blue/40"
                        style={post.imageUrl ? { backgroundImage: `url(${post.imageUrl})`, backgroundSize: 'cover' } : undefined}
                      />
                      <div className="p-6">
                        <h3 className="text-lg font-bold group-hover:text-neon-blue">{post.title}</h3>
                        <p className="mt-2 line-clamp-3 text-sm text-slate-600 dark:text-slate-400">
                          {post.aiTldr ?? 'Read the latest from our community.'}
                        </p>
                        {post.publishedAt && (
                          <p className="mt-4 text-xs text-slate-500">{formatDate(post.publishedAt)}</p>
                        )}
                      </div>
                    </div>
                  </Link>
                </motion.div>
              ))}
            </motion.div>
          )}
        </div>
      </section>

      {/* Live forum preview */}
      <section className="px-4 py-16 md:px-6">
        <div className="mx-auto max-w-7xl">
          <div className="mb-8 flex items-end justify-between">
            <div>
              <h2 className="section-title">Live Forum</h2>
              <p className="mt-2 text-slate-600 dark:text-slate-400">Join the latest community conversations.</p>
            </div>
            <Link href="/forum" className="hidden text-sm font-semibold text-neon-blue sm:inline-flex">
              Visit forum <ArrowRight className="ml-1 h-4 w-4" />
            </Link>
          </div>

          {topicsLoading ? (
            <div className="space-y-4">
              {[1, 2, 3].map((i) => (
                <div key={i} className="glass-card h-24 animate-pulse p-6" />
              ))}
            </div>
          ) : recentTopics.length === 0 ? (
            <p className="text-slate-500">No forum topics yet. Be the first to start a conversation!</p>
          ) : (
            <motion.div variants={container} initial="hidden" whileInView="show" viewport={{ once: true }} className="space-y-4">
              {recentTopics.map((topic) => (
                <motion.div key={topic.id} variants={item}>
                  <Link href={`/forum/topics/${topic.id}`}>
                    <div className="glass-card flex flex-col gap-2 p-6 transition-colors hover:bg-white/5 sm:flex-row sm:items-center sm:justify-between">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 text-xs text-slate-500">
                          <span className="rounded-full bg-neon-blue/10 px-2 py-0.5 text-neon-blue">
                            {topic.category?.name ?? 'General'}
                          </span>
                          <span>•</span>
                          <span>{topic.user?.name ?? 'Community member'}</span>
                        </div>
                        <h3 className="mt-1 truncate font-semibold">{topic.title}</h3>
                        <p className="line-clamp-1 text-sm text-slate-600 dark:text-slate-400">{topic.content}</p>
                      </div>
                      <div className="flex items-center gap-4 text-sm text-slate-500">
                        <span className="inline-flex items-center gap-1">
                          <MessageSquare className="h-4 w-4" />
                          {topic._count?.posts ?? 0}
                        </span>
                        <span>{formatDate(topic.createdAt)}</span>
                      </div>
                    </div>
                  </Link>
                </motion.div>
              ))}
            </motion.div>
          )}
        </div>
      </section>
    </div>
  );
}

export default function HomePage() {
  const { data: homePage, isLoading: homePageLoading } = useQuery<{ blocks: PageBlock[] }>({
    queryKey: ['pages', 'home'],
    queryFn: async () => {
      const { data } = await api.get('/pages/home');
      return data;
    },
    retry: false
  });

  if (homePageLoading) {
    return (
      <div className="flex h-96 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-neon-blue" />
      </div>
    );
  }

  if (homePage?.blocks) {
    return (
      <div className="relative overflow-hidden">
        <BlockRenderer blocks={homePage.blocks} />
      </div>
    );
  }

  return <HomePageContent />;
}
