'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from '@/i18n/routing';
import { motion } from 'framer-motion';
import { useTranslations } from 'next-intl';
import {
  Calendar,
  Heart,
  Briefcase,
  Users,
  Sparkles,
  ChevronLeft,
  ChevronRight,
  ArrowRight,
  Hash,
  MessageCircle,
  Store,
  Trophy,
  MapPin,
  Clock
} from 'lucide-react';
import { api } from '@/lib/api';
import { useAuth } from '@/hooks/useAuth';
import VideoOverlay from '@/components/ui/VideoOverlay';
import VideoPlayer from '@/components/ui/VideoPlayer';
import { getVideoMimeType } from '@/lib/utils';

interface EventItem {
  id: string;
  title: string;
  description?: string | null;
  location?: string | null;
  startDatetime: string;
  endDatetime: string;
  imageUrl?: string | null;
  ticketPrice: number | string;
  isFree: boolean;
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

interface ForumCategory {
  id: string;
  name: string;
  description?: string | null;
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

function initials(name: string) {
  return name
    .split(' ')
    .map((w) => w[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase();
}

const container = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.08 }
  }
};

const item = {
  hidden: { opacity: 0, y: 24 },
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

  const { data: eventsData, isLoading: eventsLoading } = useQuery<{
    events: EventItem[];
    isPast: boolean;
  }>({
    queryKey: ['home', 'events', user?.id ?? 'anonymous'],
    queryFn: async () => {
      const { data: upcoming } = await api.get('/events', {
        params: { upcoming: true, limit: 3 }
      });
      const upcomingItems = upcoming?.data ?? [];
      if (upcomingItems.length > 0) {
        return { events: upcomingItems, isPast: false };
      }
      const { data: past } = await api.get('/events', {
        params: { upcoming: false, limit: 3 }
      });
      return { events: past?.data ?? [], isPast: true };
    }
  });
  const upcomingEvents = eventsData?.events ?? [];
  const showingPastEvents = eventsData?.isPast ?? false;

  const { data: fundraisers = [], isLoading: fundraisersLoading } = useQuery<FundraiserItem[]>({
    queryKey: ['fundraisers'],
    queryFn: async () => {
      const { data } = await api.get('/fundraisers');
      return data ?? [];
    }
  });

  const { data: businesses = [], isLoading: businessesLoading } = useQuery<BusinessItem[]>({
    queryKey: ['directory', 'businesses', 'local'],
    queryFn: async () => {
      const { data } = await api.get('/directory/businesses');
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

  const { data: forumCategories = [], isLoading: categoriesLoading } = useQuery<ForumCategory[]>({
    queryKey: ['forum', 'categories'],
    queryFn: async () => {
      const { data } = await api.get('/forum/categories');
      return data ?? [];
    }
  });

  const [blogIndex, setBlogIndex] = useState(0);
  const blogsPerPage = 3;
  const visibleBlogPosts = blogPosts.slice(0, 6);
  const maxBlogIndex = Math.max(0, visibleBlogPosts.length - blogsPerPage);

  const nextBlogs = () => setBlogIndex((i) => Math.min(i + 1, maxBlogIndex));
  const prevBlogs = () => setBlogIndex((i) => Math.max(i - 1, 0));

  const features = [
    { icon: Calendar, title: t('eventsCardTitle'), desc: t('eventsCardDesc'), href: '/events' },
    { icon: Heart, title: t('fundraisingCardTitle'), desc: t('fundraisingCardDesc'), href: '/fundraisers' },
    { icon: Briefcase, title: t('directoryCardTitle'), desc: t('directoryCardDesc'), href: '/directory' },
    { icon: Users, title: t('membershipCardTitle'), desc: t('membershipCardDesc'), href: '/membership' }
  ];

  const duplicatedBusinesses = [...businesses, ...businesses];

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
              {hero.videoUrl && <source src={hero.videoUrl} type={getVideoMimeType(hero.videoUrl)} />}
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
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.6 }}
            className="inline-flex items-center gap-2 rounded-full border border-neon-blue/30 bg-neon-blue/10 px-4 py-1.5 text-sm font-medium text-neon-blue backdrop-blur-sm"
          >
            <Sparkles className="h-4 w-4" />
            {t('welcomeTag')}
          </motion.div>
          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.1 }}
            className="mt-4 text-4xl font-extrabold leading-tight tracking-tight drop-shadow-lg md:mt-6 md:text-7xl"
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
          <motion.h2
            initial={{ opacity: 0, y: 12 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="section-title text-center"
          >
            {t('discoverTitle')}
          </motion.h2>
          <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {features.map((feature, idx) => (
              <Link key={feature.title} href={feature.href}>
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: idx * 0.05 }}
                  whileHover={{ y: -8, boxShadow: '0 0 30px rgba(0, 184, 148, 0.25)' }}
                  className="glass-card group relative h-full overflow-hidden p-6"
                >
                  <div className="absolute -right-6 -top-6 h-24 w-24 rounded-full bg-neon-blue/10 blur-2xl transition-colors group-hover:bg-neon-blue/20" />
                  <feature.icon className="relative h-8 w-8 text-neon-blue transition-transform group-hover:scale-110" />
                  <h3 className="relative mt-4 text-xl font-bold">{feature.title}</h3>
                  <p className="relative mt-2 text-sm text-slate-700 dark:text-slate-400">{feature.desc}</p>
                </motion.div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* Upcoming / Past Events */}
      <section className="px-4 py-16 md:px-6">
        <div className="mx-auto max-w-7xl">
          <div className="mb-8 flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-end">
            <div>
              <motion.div
                initial={{ opacity: 0, x: -12 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                className="inline-flex items-center gap-2 rounded-full border border-neon-blue/30 bg-neon-blue/10 px-3 py-1 text-xs font-semibold text-neon-blue"
              >
                <Calendar className="h-3.5 w-3.5" />
                {showingPastEvents ? t('pastEvents') : t('upcomingEvents')}
              </motion.div>
              <h2 className="section-title mt-3">
                {showingPastEvents ? t('pastEventsTitle') : t('upcomingEventsTitle')}
              </h2>
              <p className="mt-2 max-w-2xl text-slate-700 dark:text-slate-400">
                {showingPastEvents ? t('pastEventsDesc') : t('upcomingEventsDesc')}
              </p>
            </div>
            <Link href="/events" className="hidden text-sm font-semibold text-neon-blue sm:inline-flex">
              {t('viewAllEvents')} <ArrowRight className="ml-1 h-4 w-4" />
            </Link>
          </div>

          {eventsLoading ? (
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="glass-card h-80 animate-pulse" />
              ))}
            </div>
          ) : upcomingEvents.length === 0 ? (
            <p className="text-slate-600 dark:text-slate-400">{t('noUpcomingEvents')}</p>
          ) : (
            <motion.div
              variants={container}
              initial="hidden"
              whileInView="show"
              viewport={{ once: true }}
              className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3"
            >
              {upcomingEvents.map((evt) => (
                <motion.div key={evt.id} variants={item}>
                  <Link href={`/events/${evt.id}`}>
                    <motion.div
                      whileHover={{ y: -10 }}
                      transition={{ type: 'spring', stiffness: 300, damping: 20 }}
                      className="glass-card group relative overflow-hidden"
                    >
                      <div className="relative aspect-[4/3] overflow-hidden">
                        {evt.imageUrl ? (
                          <img
                            src={evt.imageUrl}
                            alt={evt.title}
                            className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-110"
                            loading="lazy"
                          />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-neon-blue/30 to-neon-gold/30">
                            <Calendar className="h-16 w-16 text-white/60" />
                          </div>
                        )}
                        <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/40 to-transparent" />
                        {showingPastEvents && (
                          <div className="absolute left-3 top-3 rounded-full bg-slate-950/60 px-3 py-1 text-xs font-semibold text-slate-300 backdrop-blur-sm">
                            {t('pastEventBadge')}
                          </div>
                        )}
                      </div>
                      <div className="p-5">
                        <h3 className="line-clamp-2 text-lg font-bold transition-colors group-hover:text-neon-blue">
                          {evt.title}
                        </h3>
                        <div className="mt-3 flex flex-wrap items-center gap-3 text-sm text-slate-600 dark:text-slate-400">
                          <span className="inline-flex items-center gap-1.5">
                            <Clock className="h-4 w-4 text-neon-blue" />
                            {formatDate(evt.startDatetime)}
                          </span>
                          {evt.location && (
                            <span className="inline-flex items-center gap-1.5">
                              <MapPin className="h-4 w-4 text-neon-gold" />
                              <span className="truncate max-w-[160px]">{evt.location}</span>
                            </span>
                          )}
                        </div>
                        <div className="mt-4 inline-flex items-center text-sm font-semibold text-neon-blue">
                          {evt.isFree || Number(evt.ticketPrice) === 0 ? t('free') : formatCurrency(evt.ticketPrice)}
                          <ArrowRight className="ml-1 h-4 w-4 transition-transform group-hover:translate-x-1" />
                        </div>
                      </div>
                    </motion.div>
                  </Link>
                </motion.div>
              ))}
            </motion.div>
          )}

          <div className="mt-6 sm:hidden">
            <Link href="/events" className="text-sm font-semibold text-neon-blue inline-flex">
              {t('viewAllEvents')} <ArrowRight className="ml-1 h-4 w-4" />
            </Link>
          </div>
        </div>
      </section>

      {/* Active Fundraisers */}
      <section className="relative px-4 py-16 md:px-6">
        <div className="pointer-events-none absolute inset-0 -z-10 bg-gradient-to-b from-rose-500/5 via-transparent to-transparent" />
        <div className="mx-auto max-w-7xl">
          <div className="mb-8 flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-end">
            <div>
              <motion.div
                initial={{ opacity: 0, x: -12 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                className="inline-flex items-center gap-2 rounded-full border border-rose-400/30 bg-rose-500/10 px-3 py-1 text-xs font-semibold text-rose-500"
              >
                <Heart className="h-3.5 w-3.5" />
                {t('activeFundraisersTag')}
              </motion.div>
              <h2 className="section-title mt-3">{t('fundraisersTitle')}</h2>
              <p className="mt-2 max-w-2xl text-slate-700 dark:text-slate-400">{t('fundraisersDesc')}</p>
            </div>
            <Link href="/fundraisers" className="hidden text-sm font-semibold text-neon-blue sm:inline-flex">
              {t('viewAllFundraisers')} <ArrowRight className="ml-1 h-4 w-4" />
            </Link>
          </div>

          {fundraisersLoading ? (
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="glass-card h-80 animate-pulse" />
              ))}
            </div>
          ) : fundraisers.length === 0 ? (
            <p className="text-slate-600 dark:text-slate-400">{t('noActiveFundraisers')}</p>
          ) : (
            <motion.div
              variants={container}
              initial="hidden"
              whileInView="show"
              viewport={{ once: true }}
              className="grid gap-6 md:grid-cols-2 lg:grid-cols-3"
            >
              {fundraisers.map((f) => {
                const progress = f.targetAmount > 0 ? Math.min((f.raisedAmount / f.targetAmount) * 100, 100) : 0;
                return (
                  <motion.div key={f.id} variants={item}>
                    <Link href={`/fundraisers/${f.id}`}>
                      <motion.div
                        whileHover={{ y: -8 }}
                        transition={{ type: 'spring', stiffness: 300, damping: 20 }}
                        className="glass-card group flex h-full flex-col overflow-hidden"
                      >
                        <div className="relative aspect-video overflow-hidden">
                          {f.imageUrl ? (
                            <img
                              src={f.imageUrl}
                              alt={f.title}
                              className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-110"
                              loading="lazy"
                            />
                          ) : (
                            <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-rose-500/30 to-neon-blue/30">
                              <Heart className="h-16 w-16 text-white/60" />
                            </div>
                          )}
                          <div className="absolute inset-0 bg-gradient-to-t from-slate-950/80 to-transparent" />
                        </div>
                        <div className="flex flex-1 flex-col p-5">
                          <h3 className="text-lg font-bold transition-colors group-hover:text-rose-500">{f.title}</h3>
                          <p className="mt-2 line-clamp-2 flex-1 text-sm text-slate-700 dark:text-slate-400">
                            {f.description ?? ''}
                          </p>
                          <div className="mt-4">
                            <div className="h-3 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700">
                              <motion.div
                                initial={{ width: 0 }}
                                whileInView={{ width: `${progress}%` }}
                                viewport={{ once: true }}
                                transition={{ duration: 1, ease: 'easeOut' }}
                                className="h-full rounded-full bg-gradient-to-r from-rose-500 to-neon-gold"
                              />
                            </div>
                            <div className="mt-2 flex justify-between text-sm">
                              <span className="font-medium text-rose-500">{t('raised', { amount: formatCurrency(f.raisedAmount) })}</span>
                              <span className="text-slate-600 dark:text-slate-400">{t('goal', { amount: formatCurrency(f.targetAmount) })}</span>
                            </div>
                          </div>
                          <div className="mt-4 inline-flex items-center text-sm font-semibold text-neon-blue">
                            {t('donateNow')}
                            <ArrowRight className="ml-1 h-4 w-4 transition-transform group-hover:translate-x-1" />
                          </div>
                        </div>
                      </motion.div>
                    </Link>
                  </motion.div>
                );
              })}
            </motion.div>
          )}

          <div className="mt-6 sm:hidden">
            <Link href="/fundraisers" className="text-sm font-semibold text-neon-blue inline-flex">
              {t('viewAllFundraisers')} <ArrowRight className="ml-1 h-4 w-4" />
            </Link>
          </div>
        </div>
      </section>

      {/* Local Businesses logo scroll */}
      <section className="relative overflow-hidden px-4 py-16 md:px-6">
        <div className="pointer-events-none absolute inset-0 -z-10 bg-gradient-to-b from-neon-gold/5 via-transparent to-transparent" />
        <div className="mx-auto max-w-7xl">
          <div className="mb-8 flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-end">
            <div>
              <motion.div
                initial={{ opacity: 0, x: -12 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                className="inline-flex items-center gap-2 rounded-full border border-neon-gold/30 bg-neon-gold/10 px-3 py-1 text-xs font-semibold text-amber-700 dark:text-neon-gold"
              >
                <Store className="h-3.5 w-3.5" />
                {t('localBusinessesTag')}
              </motion.div>
              <h2 className="section-title mt-3">{t('localBusinessesTitle')}</h2>
              <p className="mt-2 max-w-2xl text-slate-700 dark:text-slate-400">{t('localBusinessesDesc')}</p>
            </div>
            <Link href="/directory" className="hidden text-sm font-semibold text-neon-blue sm:inline-flex">
              {t('viewAllBusinesses')} <ArrowRight className="ml-1 h-4 w-4" />
            </Link>
          </div>
        </div>

        {businessesLoading ? (
          <div className="mx-auto max-w-7xl">
            <div className="flex gap-6">
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="h-24 w-24 flex-shrink-0 animate-pulse rounded-2xl bg-white/10" />
              ))}
            </div>
          </div>
        ) : businesses.length === 0 ? (
          <div className="mx-auto max-w-7xl">
            <p className="text-slate-600 dark:text-slate-400">{t('noBusinesses')}</p>
          </div>
        ) : (
          <div className="relative">
            <div className="pointer-events-none absolute inset-y-0 left-0 z-10 w-16 bg-gradient-to-r from-slate-50 to-transparent dark:from-slate-950" />
            <div className="pointer-events-none absolute inset-y-0 right-0 z-10 w-16 bg-gradient-to-l from-slate-50 to-transparent dark:from-slate-950" />
            <div className="animate-marquee hover:[animation-play-state:paused] flex w-max gap-6">
              {duplicatedBusinesses.map((business, idx) => (
                <Link
                  key={`${business.id}-${idx}`}
                  href={`/directory/${business.id}`}
                  className="group flex flex-col items-center gap-3 rounded-2xl border border-transparent p-3 transition-all hover:border-neon-gold/30 hover:bg-neon-gold/5"
                >
                  <div className="relative h-24 w-24 overflow-hidden rounded-2xl bg-gradient-to-br from-neon-gold/30 to-amber-500/30 shadow-lg transition-all duration-300 group-hover:scale-110 group-hover:shadow-gold">
                    {business.logoUrl ? (
                      <img
                        src={business.logoUrl}
                        alt={business.businessName}
                        className="h-full w-full object-cover"
                        loading="lazy"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-lg font-bold text-amber-900 dark:text-amber-100">
                        {initials(business.businessName)}
                      </div>
                    )}
                    {business.isPromoted && (
                      <div className="absolute -right-4 -top-4">
                        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-neon-gold text-[10px] font-bold text-amber-900 shadow-gold">
                          <Trophy className="h-3.5 w-3.5" />
                        </div>
                      </div>
                    )}
                  </div>
                  <span className="max-w-[96px] truncate text-center text-xs font-medium text-slate-700 dark:text-slate-300">
                    {business.businessName}
                  </span>
                </Link>
              ))}
            </div>
          </div>
        )}

        <div className="mx-auto mt-6 max-w-7xl sm:hidden">
          <Link href="/directory" className="text-sm font-semibold text-neon-blue inline-flex">
            {t('viewAllBusinesses')} <ArrowRight className="ml-1 h-4 w-4" />
          </Link>
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
            <div className="hidden items-center gap-2 sm:flex">
              <button
                onClick={prevBlogs}
                disabled={blogIndex === 0}
                className="rounded-full border border-slate-300 bg-white p-2 transition-colors hover:bg-slate-200 disabled:opacity-30 dark:border-white/20 dark:bg-transparent dark:hover:bg-white/10"
                aria-label={t('previous')}
              >
                <ChevronLeft className="h-5 w-5" />
              </button>
              <button
                onClick={nextBlogs}
                disabled={blogIndex >= maxBlogIndex}
                className="rounded-full border border-slate-300 bg-white p-2 transition-colors hover:bg-slate-200 disabled:opacity-30 dark:border-white/20 dark:bg-transparent dark:hover:bg-white/10"
                aria-label={t('next')}
              >
                <ChevronRight className="h-5 w-5" />
              </button>
            </div>
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
            <div className="overflow-hidden">
              <motion.div
                className="flex gap-6"
                animate={{ x: `-${blogIndex * (100 / blogsPerPage)}%` }}
                transition={{ type: 'spring', stiffness: 300, damping: 30 }}
              >
                {visibleBlogPosts.map((post) => (
                  <div
                    key={post.id}
                    className="w-full flex-shrink-0 md:w-[calc(33.333%-1rem)]"
                  >
                    <Link href={`/blog/${post.slug}`}>
                      <motion.div
                        whileHover={{ y: -6 }}
                        className="glass-card group h-full overflow-hidden p-0"
                      >
                        <div className="relative aspect-video overflow-hidden">
                          <div
                            className="h-full w-full bg-gradient-to-br from-neon-purple/40 to-neon-blue/40 transition-transform duration-700 group-hover:scale-110"
                            style={post.imageUrl ? { backgroundImage: `url(${post.imageUrl})`, backgroundSize: 'cover' } : undefined}
                          />
                        </div>
                        <div className="p-6">
                          <h3 className="text-lg font-bold group-hover:text-neon-blue">{post.title}</h3>
                          <p className="mt-2 line-clamp-3 text-sm text-slate-700 dark:text-slate-400">
                            {post.aiTldr ?? t('blogFallback')}
                          </p>
                          {post.publishedAt && (
                            <p className="mt-4 text-xs text-slate-600 dark:text-slate-400">{formatDate(post.publishedAt)}</p>
                          )}
                        </div>
                      </motion.div>
                    </Link>
                  </div>
                ))}
              </motion.div>
            </div>
          )}

          <div className="mt-4 flex items-center justify-between sm:hidden">
            <Link href="/blog" className="text-sm font-semibold text-neon-blue inline-flex">
              {t('readAllPosts')} <ArrowRight className="ml-1 h-4 w-4" />
            </Link>
            <div className="flex gap-2">
              <button
                onClick={prevBlogs}
                disabled={blogIndex === 0}
                className="rounded-full border border-slate-300 bg-white p-2 transition-colors hover:bg-slate-200 disabled:opacity-30 dark:border-white/20 dark:bg-transparent dark:hover:bg-white/10"
                aria-label={t('previous')}
              >
                <ChevronLeft className="h-5 w-5" />
              </button>
              <button
                onClick={nextBlogs}
                disabled={blogIndex >= maxBlogIndex}
                className="rounded-full border border-slate-300 bg-white p-2 transition-colors hover:bg-slate-200 disabled:opacity-30 dark:border-white/20 dark:bg-transparent dark:hover:bg-white/10"
                aria-label={t('next')}
              >
                <ChevronRight className="h-5 w-5" />
              </button>
            </div>
          </div>

          <div className="mt-4 hidden sm:block">
            <Link href="/blog" className="text-sm font-semibold text-neon-blue inline-flex">
              {t('readAllPosts')} <ArrowRight className="ml-1 h-4 w-4" />
            </Link>
          </div>
        </div>
      </section>

      {/* Start a conversation */}
      <section className="relative px-4 py-16 md:px-6">
        <div className="pointer-events-none absolute inset-0 -z-10 bg-gradient-to-b from-neon-blue/5 via-transparent to-transparent" />
        <div className="mx-auto max-w-7xl">
          <div className="mb-8 flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-end">
            <div>
              <motion.div
                initial={{ opacity: 0, x: -12 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                className="inline-flex items-center gap-2 rounded-full border border-neon-blue/30 bg-neon-blue/10 px-3 py-1 text-xs font-semibold text-neon-blue"
              >
                <MessageCircle className="h-3.5 w-3.5" />
                {t('startConversationTag')}
              </motion.div>
              <h2 className="section-title mt-3">{t('startConversationTitle')}</h2>
              <p className="mt-2 max-w-2xl text-slate-700 dark:text-slate-400">{t('startConversationDesc')}</p>
            </div>
            <Link href="/forum" className="hidden text-sm font-semibold text-neon-blue sm:inline-flex">
              {t('visitForum')} <ArrowRight className="ml-1 h-4 w-4" />
            </Link>
          </div>

          {categoriesLoading ? (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="glass-card h-32 animate-pulse" />
              ))}
            </div>
          ) : forumCategories.length === 0 ? (
            <p className="text-slate-600 dark:text-slate-400">{t('noCategories')}</p>
          ) : (
            <motion.div
              variants={container}
              initial="hidden"
              whileInView="show"
              viewport={{ once: true }}
              className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4"
            >
              {forumCategories.map((category) => (
                <motion.div key={category.id} variants={item}>
                  <Link href={`/forum/categories/${category.id}`}>
                    <motion.div
                      whileHover={{ y: -6, scale: 1.02 }}
                      transition={{ type: 'spring', stiffness: 400, damping: 20 }}
                      className="glass-card group relative overflow-hidden p-5"
                    >
                      <div className="absolute -right-6 -top-6 h-20 w-20 rounded-full bg-neon-blue/10 blur-xl transition-colors group-hover:bg-neon-blue/20" />
                      <div className="relative flex items-start justify-between">
                        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-neon-blue/10 text-neon-blue">
                          <Hash className="h-5 w-5" />
                        </div>
                        <ArrowRight className="h-5 w-5 text-slate-400 transition-all group-hover:translate-x-1 group-hover:text-neon-blue" />
                      </div>
                      <h3 className="relative mt-4 font-bold transition-colors group-hover:text-neon-blue">{category.name}</h3>
                      {category.description && (
                        <p className="relative mt-1 line-clamp-2 text-sm text-slate-600 dark:text-slate-400">{category.description}</p>
                      )}
                    </motion.div>
                  </Link>
                </motion.div>
              ))}
            </motion.div>
          )}

          <div className="mt-6 sm:hidden">
            <Link href="/forum" className="text-sm font-semibold text-neon-blue inline-flex">
              {t('visitForum')} <ArrowRight className="ml-1 h-4 w-4" />
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
