'use client';

import { useState } from 'react';
import { Link } from '@/i18n/routing';
import { motion } from 'framer-motion';
import { useQuery } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
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
import VideoOverlay from '@/components/ui/VideoOverlay';
import VideoPlayer from '@/components/ui/VideoPlayer';

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

function formatDate(date: string | Date | null | undefined) {
  if (!date) return 'TBC';
  const d = typeof date === 'string' ? new Date(date) : date;
  if (isNaN(d.getTime())) return 'Invalid date';
  return d.toLocaleDateString('en-GB', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric'
  });
}

function formatCurrency(value: number | string | null | undefined) {
  const num = typeof value === 'string' ? Number(value) : value;
  if (num == null || Number.isNaN(num)) return '£0.00';
  return new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' }).format(num);
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

interface HeroConfig {
  mediaType: 'image' | 'video';
  imageUrl: string | null;
  videoUrl: string | null;
  overlayStyle: 'none' | 'dots' | 'noise' | 'scanlines' | 'vignette';
  overlayOpacity: number;
  videoOverlayOpacity: number;
  videoPlaybackRate: number;
}

const DEFAULT_HERO: HeroConfig = {
  mediaType: 'video',
  imageUrl: '',
  videoUrl: '/videos/kslsc-hero.webm',
  overlayStyle: 'noise',
  overlayOpacity: 75,
  videoOverlayOpacity: 75,
  videoPlaybackRate: 1
};

export default function HomePageContent() {
  const t = useTranslations('home');
  const { data: user } = useAuth();

  const { data: heroConfig } = useQuery<HeroConfig>({
    queryKey: ['hero-config'],
    queryFn: async () => {
      const { data } = await api.get('/hero-config');
      return data;
    },
    retry: false
  });
  const hero = heroConfig ?? DEFAULT_HERO;

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

  const features = [
    { icon: Calendar, title: t('eventsCardTitle'), desc: t('eventsCardDesc'), href: '/events' },
    { icon: Heart, title: t('fundraisingCardTitle'), desc: t('fundraisingCardDesc'), href: '/fundraisers' },
    { icon: Briefcase, title: t('directoryCardTitle'), desc: t('directoryCardDesc'), href: '/directory' },
    { icon: Users, title: t('membershipCardTitle'), desc: t('membershipCardDesc'), href: '/membership' }
  ];

  return (
    <div className="relative overflow-hidden">
      {/* Animated background blobs */}
      <div className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
        <motion.div
          animate={{ x: [0, 30, 0], y: [0, -20, 0] }}
          transition={{ duration: 8, repeat: Infinity, ease: 'easeInOut' }}
          className="absolute -left-20 top-20 h-72 w-72 rounded-full bg-neon-blue/30 blur-3xl"
        />
        <motion.div
          animate={{ x: [0, -20, 0], y: [0, 30, 0] }}
          transition={{ duration: 10, repeat: Infinity, ease: 'easeInOut' }}
          className="absolute bottom-20 right-0 h-96 w-96 rounded-full bg-neon-gold/30 blur-3xl"
        />
        <motion.div
          animate={{ x: [0, 20, 0], y: [0, 20, 0] }}
          transition={{ duration: 12, repeat: Infinity, ease: 'easeInOut' }}
          className="absolute left-1/3 top-1/2 h-64 w-64 rounded-full bg-neon-purple/30 blur-3xl"
        />
      </div>

      <section className="relative flex min-h-[calc(100vh-68px)] items-center overflow-hidden px-4 py-24 md:px-6 md:py-20">
        {hero.mediaType === 'video' && hero.videoUrl && (
          <>
            <VideoPlayer
              autoPlay
              muted
              loop
              playsInline
              aria-hidden="true"
              playbackRate={hero.videoPlaybackRate ?? 1}
              className="pointer-events-none absolute inset-0 -z-10 h-full w-full object-cover"
              style={{ backgroundColor: 'transparent' }}
            >
              {hero.videoUrl.endsWith('.webm') && <source src={hero.videoUrl} type="video/webm" />}
              {hero.videoUrl.endsWith('.mp4') && <source src={hero.videoUrl} type="video/mp4" />}
              {hero.videoUrl.endsWith('.webm') && (
                <source src={hero.videoUrl.replace(/\.webm$/, '.mp4')} type="video/mp4" />
              )}
              {/* Fallback to the default hero video if the configured file is missing */}
              <source src="/videos/kslsc-hero.mp4" type="video/mp4" />
              <source src="/videos/kslsc-hero.webm" type="video/webm" />
            </VideoPlayer>
            <VideoOverlay style={hero.overlayStyle as import('@/components/ui/VideoOverlay').OverlayStyle} opacity={hero.videoOverlayOpacity} />
            {/* Fade the video into the neon lava header */}
            <div className="pointer-events-none absolute inset-x-0 top-0 z-0 h-40 bg-gradient-to-b from-slate-950/80 via-slate-950/30 to-transparent" />
          </>
        )}
        {hero.mediaType === 'image' && hero.imageUrl && (
          <>
            <div
              className="pointer-events-none absolute inset-0 -z-10 bg-cover bg-center"
              style={{ backgroundImage: `url(${hero.imageUrl})` }}
            />
            <VideoOverlay style={hero.overlayStyle as import('@/components/ui/VideoOverlay').OverlayStyle} opacity={hero.overlayOpacity} />
          </>
        )}
        {!(hero.mediaType === 'video' && hero.videoUrl) && !(hero.mediaType === 'image' && hero.imageUrl) && (
          <div className="pointer-events-none absolute inset-0 -z-10 bg-slate-900" />
        )}
        <div className="relative z-10 mx-auto max-w-5xl text-center text-slate-100">
          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.1 }}
            className="mt-2 text-4xl font-extrabold leading-tight tracking-tight drop-shadow-lg md:mt-6 md:text-7xl"
          >
            Kent{' '}
            <span className="gradient-text-animated whitespace-nowrap">Sri Lankan</span>
            <br /> Social Club
          </motion.h1>
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="mx-auto mt-3 max-w-2xl px-4 text-xs font-light leading-relaxed text-slate-200 drop-shadow sm:text-sm md:text-base"
          >
            {t('subtitle')}
          </motion.p>
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.3 }}
            className="mt-5 flex w-full flex-col items-center justify-center gap-3 px-4 sm:flex-row"
          >
            {!user && (
              <Link
                href="/membership"
                className="btn-primary h-12 w-full whitespace-nowrap px-4 py-2.5 text-center text-sm sm:w-48"
              >
                {t('becomeMember')}
              </Link>
            )}
            <Link
              href="/events"
              className="btn-secondary h-12 w-full whitespace-nowrap px-4 py-2.5 text-center text-sm sm:w-48"
            >
              {t('exploreEvents')}
            </Link>
          </motion.div>
        </div>
      </section>

      <section className="px-4 py-16 md:px-6">
        <div className="mx-auto max-w-7xl">
          <h2 className="section-title text-center">{t('discoverTitle')}</h2>
          <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {features.map((feature) => (
              <Link key={feature.title} href={feature.href}>
                <motion.div
                  whileHover={{ y: -6 }}
                  className="glass-card h-full p-6 hover:shadow-neon"
                >
                  <feature.icon className="h-8 w-8 text-neon-blue" />
                  <h3 className="mt-4 text-xl font-bold">{feature.title}</h3>
                  <p className="mt-2 text-sm text-slate-700 dark:text-slate-400">{feature.desc}</p>
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
                <h3 className="text-2xl font-bold">{t('recommendedEventsTitle')}</h3>
              </div>
              <p className="mt-2 text-slate-700 dark:text-slate-400">
                {t('recommendedEventsDesc')}
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
                  <p className="text-sm text-slate-600 dark:text-slate-400">{t('noUpcomingEvents')}</p>
                ) : (
                  recommendedEvents.map((evt) => (
                    <Link key={evt.id} href={`/events/${evt.id}`}>
                      <motion.div
                        whileHover={{ x: 4 }}
                        className="flex items-center gap-4 rounded-xl bg-slate-200/60 p-4 transition-colors hover:bg-slate-200/80 dark:bg-white/5 dark:hover:bg-white/10"
                      >
                        <div
                          className="h-12 w-12 flex-shrink-0 rounded-lg bg-gradient-to-br from-neon-blue to-neon-gold"
                          style={evt.imageUrl ? { backgroundImage: `url(${evt.imageUrl})`, backgroundSize: 'cover' } : undefined}
                        />
                        <div className="min-w-0">
                          <p className="truncate font-semibold">{evt.title}</p>
                          <p className="text-sm text-slate-600 dark:text-slate-400">
                            {formatDate(evt.startDatetime)} • {evt.location ?? 'TBC'}
                          </p>
                        </div>
                      </motion.div>
                    </Link>
                  ))
                )}
              </div>
              <Link href="/events" className="btn-secondary mt-6 inline-flex">
                {t('viewAllEvents')}
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
                <h3 className="text-2xl font-bold">{t('featuredFundraiserTitle')}</h3>
              </div>
              <p className="mt-2 text-slate-700 dark:text-slate-400">
                {t('featuredFundraiserDesc')}
              </p>
              {fundraisersLoading ? (
                <div className="mt-6 animate-pulse space-y-4">
                  <div className="h-6 w-3/4 rounded bg-slate-300 dark:bg-slate-700" />
                  <div className="h-4 w-full rounded-full bg-slate-300 dark:bg-slate-700" />
                  <div className="h-4 w-1/2 rounded bg-slate-300 dark:bg-slate-700" />
                </div>
              ) : !featuredFundraiser ? (
                <p className="mt-6 text-sm text-slate-600 dark:text-slate-400">{t('noActiveFundraisers')}</p>
              ) : (
                <div className="mt-6">
                  <h4 className="text-xl font-semibold">{featuredFundraiser.title}</h4>
                  <p className="mt-1 line-clamp-2 text-sm text-slate-600 dark:text-slate-400">{featuredFundraiser.description}</p>
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
                    <span>{t('raised', { amount: formatCurrency(featuredFundraiser.raisedAmount) })}</span>
                    <span>{t('goal', { amount: formatCurrency(featuredFundraiser.targetAmount) })}</span>
                  </div>
                  <Link href={`/fundraisers/${featuredFundraiser.id}`} className="btn-primary mt-6 inline-block">
                    {t('donateNow')}
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
              <h2 className="section-title">{t('promotedBusinessesTitle')}</h2>
              <p className="mt-2 text-slate-700 dark:text-slate-400">{t('promotedBusinessesDesc')}</p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={prevBusinesses}
                disabled={businessIndex === 0}
                className="rounded-full border border-slate-300 bg-white p-2 transition-colors hover:bg-slate-200 disabled:opacity-30 dark:border-white/20 dark:bg-transparent dark:hover:bg-white/10"
                aria-label={t('previous')}
              >
                <ChevronLeft className="h-5 w-5" />
              </button>
              <button
                onClick={nextBusinesses}
                disabled={businessIndex >= maxBusinessIndex}
                className="rounded-full border border-slate-300 bg-white p-2 transition-colors hover:bg-slate-200 disabled:opacity-30 dark:border-white/20 dark:bg-transparent dark:hover:bg-white/10"
                aria-label={t('next')}
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
            <p className="text-slate-600 dark:text-slate-400">{t('noPromotedBusinesses')}</p>
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
                      <span className="rounded-full bg-neon-gold/20 px-2 py-1 text-xs font-medium text-amber-900 dark:bg-neon-gold/10 dark:text-neon-gold">
                        {t('promoted')}
                      </span>
                    </div>
                    <h3 className="mt-4 text-lg font-bold">{business.businessName}</h3>
                    <p className="mt-1 line-clamp-2 flex-1 text-sm text-slate-700 dark:text-slate-400">
                      {business.description ?? business.category ?? t('businessFallback')}
                    </p>
                    <Link href={`/directory/${business.id}`} className="mt-4 inline-flex items-center text-sm font-semibold text-neon-blue">
                      {t('viewListing')} <ArrowRight className="ml-1 h-4 w-4" />
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
              <h2 className="section-title">{t('latestBlogTitle')}</h2>
              <p className="mt-2 text-slate-700 dark:text-slate-400">{t('latestBlogDesc')}</p>
            </div>
            <Link href="/blog" className="hidden text-sm font-semibold text-neon-blue sm:inline-flex">
              {t('readAllPosts')} <ArrowRight className="ml-1 h-4 w-4" />
            </Link>
          </div>

          {blogLoading ? (
            <div className="grid gap-6 md:grid-cols-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="glass-card h-64 animate-pulse p-0" />
              ))}
            </div>
          ) : blogPosts.length === 0 ? (
            <p className="text-slate-600 dark:text-slate-400">{t('noBlogPosts')}</p>
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
                        <p className="mt-2 line-clamp-3 text-sm text-slate-700 dark:text-slate-400">
                          {post.aiTldr ?? t('blogFallback')}
                        </p>
                        {post.publishedAt && (
                          <p className="mt-4 text-xs text-slate-600 dark:text-slate-400">{formatDate(post.publishedAt)}</p>
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
              <h2 className="section-title">{t('liveForumTitle')}</h2>
              <p className="mt-2 text-slate-700 dark:text-slate-400">{t('liveForumDesc')}</p>
            </div>
            <Link href="/forum" className="hidden text-sm font-semibold text-neon-blue sm:inline-flex">
              {t('visitForum')} <ArrowRight className="ml-1 h-4 w-4" />
            </Link>
          </div>

          {topicsLoading ? (
            <div className="space-y-4">
              {[1, 2, 3].map((i) => (
                <div key={i} className="glass-card h-24 animate-pulse p-6" />
              ))}
            </div>
          ) : recentTopics.length === 0 ? (
            <p className="text-slate-600 dark:text-slate-400">{t('noForumTopics')}</p>
          ) : (
            <motion.div variants={container} initial="hidden" whileInView="show" viewport={{ once: true }} className="space-y-4">
              {recentTopics.map((topic) => (
                <motion.div key={topic.id} variants={item}>
                  <Link href={`/forum/topics/${topic.id}`}>
                    <div className="glass-card flex flex-col gap-2 p-6 transition-colors hover:bg-slate-200/60 dark:hover:bg-white/5 sm:flex-row sm:items-center sm:justify-between">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-400">
                          <span className="rounded-full bg-neon-blue/10 px-2 py-0.5 text-neon-blue">
                            {topic.category?.name ?? t('general')}
                          </span>
                          <span>•</span>
                          <span>{topic.user?.name ?? t('communityMember')}</span>
                        </div>
                        <h3 className="mt-1 truncate font-semibold">{topic.title}</h3>
                        <p className="line-clamp-1 text-sm text-slate-700 dark:text-slate-400">{topic.content}</p>
                      </div>
                      <div className="flex items-center gap-4 text-sm text-slate-600 dark:text-slate-400">
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
