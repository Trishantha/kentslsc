'use client';

import { useState } from 'react';
import { Link } from '@/i18n/routing';
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
import { useAuth } from '@/hooks/useAuth';
import { useInView } from '@/hooks/useInView';
import { FadeIn } from '@/components/ui/FadeIn';
import { summarizeRichText } from '@/lib/rich-text';
import VideoOverlay from '@/components/ui/VideoOverlay';
import VideoPlayer from '@/components/ui/VideoPlayer';
import type { HeroConfig } from '@/lib/hero-config';
import type {
  BlockBusinessItem,
  BlockEventItem,
  BlockForumCategory,
  BlockFundraiserItem
} from '@/lib/server-blocks';
import { getVideoMimeType, formatDate, formatCurrency } from '@/lib/utils';
import type { MixedBlogListItem } from '@kentslsc/shared';

interface EventItem extends BlockEventItem {
  endDatetime?: string;
}

interface FundraiserItem extends BlockFundraiserItem {}

interface BusinessItem extends BlockBusinessItem {}

type ForumCategory = BlockForumCategory;

interface HomePageContentProps {
  hero: HeroConfig;
  events: { events: EventItem[]; isPast: boolean };
  fundraisers: FundraiserItem[];
  businesses: BusinessItem[];
  blogPosts: MixedBlogListItem[];
  forumCategories: ForumCategory[];
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

function ProgressBar({ progress }: { progress: number }) {
  const { ref, inView } = useInView<HTMLDivElement>();
  return (
    <div className="h-3 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700">
      <div
        ref={ref}
        className="h-full rounded-full bg-gradient-to-r from-rose-500 to-neon-gold transition-[width] duration-1000 ease-out"
        style={{ width: inView ? `${progress}%` : '0%' }}
      />
    </div>
  );
}

export default function HomePageContent({
  hero,
  events: eventsData,
  fundraisers,
  businesses,
  blogPosts,
  forumCategories
}: HomePageContentProps) {
  const t = useTranslations('home');
  const tCommon = useTranslations('common');
  const { data: user } = useAuth();

  const upcomingEvents = eventsData.events;
  const showingPastEvents = eventsData.isPast;

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
        <div
          className="animate-blob absolute -left-20 top-20 h-72 w-72 rounded-full bg-neon-blue/30 blur-3xl"
          style={{ animationDuration: '8s' }}
        />
        <div
          className="animate-blob absolute bottom-20 right-0 h-96 w-96 rounded-full bg-neon-gold/30 blur-3xl"
          style={{ animationDuration: '10s' }}
        />
        <div
          className="animate-blob absolute left-1/3 top-1/2 h-64 w-64 rounded-full bg-neon-purple/30 blur-3xl"
          style={{ animationDuration: '12s' }}
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
          <div
            className="animate-fade-in-up-lg inline-flex items-center gap-2 rounded-full border border-neon-blue/30 bg-neon-blue/10 px-4 py-1.5 text-sm font-medium text-neon-blue backdrop-blur-sm"
          >
            <Sparkles className="h-4 w-4" />
            {t('welcomeTag')}
          </div>
          <h1
            className="animate-fade-in-up-lg mt-4 text-4xl font-extrabold leading-tight tracking-tight drop-shadow-lg md:mt-6 md:text-7xl"
            style={{ animationDelay: '0.1s' }}
          >
            Kent{' '}
            <span className="gradient-text-animated whitespace-nowrap">Sri Lankan</span>
            <br /> Social Club
          </h1>
          <p
            className="animate-fade-in-up-lg mx-auto mt-3 max-w-2xl px-4 text-xs font-light leading-relaxed text-slate-200 drop-shadow sm:text-sm md:text-base"
            style={{ animationDelay: '0.2s' }}
          >
            {t('subtitle')}
          </p>
          <div
            className="animate-fade-in-up-lg mt-5 flex w-full flex-col items-center justify-center gap-3 px-4 sm:flex-row"
            style={{ animationDelay: '0.3s' }}
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
          </div>
        </div>
      </section>

      <section className="px-4 py-16 md:px-6">
        <div className="mx-auto max-w-7xl">
          <FadeIn>
            <h2 className="section-title text-center">{t('discoverTitle')}</h2>
          </FadeIn>
          <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {features.map((feature, idx) => (
              <Link key={feature.title} href={feature.href}>
                <FadeIn
                  delay={idx * 0.05}
                  className="glass-card group relative h-full overflow-hidden p-6 transition-all hover:-translate-y-2 hover:shadow-[0_0_30px_rgba(0,184,148,0.25)]"
                >
                  <div className="absolute -right-6 -top-6 h-24 w-24 rounded-full bg-neon-blue/10 blur-2xl transition-colors group-hover:bg-neon-blue/20" />
                  <feature.icon className="relative h-8 w-8 text-neon-blue transition-transform group-hover:scale-110" />
                  <h3 className="relative mt-4 text-xl font-bold">{feature.title}</h3>
                  <p className="relative mt-2 text-sm text-slate-700 dark:text-slate-400">{feature.desc}</p>
                </FadeIn>
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
              <FadeIn className="inline-flex items-center gap-2 rounded-full border border-neon-blue/30 bg-neon-blue/10 px-3 py-1 text-xs font-semibold text-neon-blue">
                <Calendar className="h-3.5 w-3.5" />
                {showingPastEvents ? t('pastEvents') : t('upcomingEvents')}
              </FadeIn>
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

          {upcomingEvents.length === 0 ? (
            <p className="text-slate-600 dark:text-slate-400">{t('noUpcomingEvents')}</p>
          ) : (
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {upcomingEvents.map((evt, idx) => (
                <FadeIn key={evt.id} delay={idx * 0.08}>
                  <Link href={`/events/${evt.id}`}>
                    <div className="glass-card group relative overflow-hidden transition-transform duration-300 hover:-translate-y-2">
                      <div className="relative aspect-[4/3] overflow-hidden bg-gradient-to-br from-neon-blue/50 via-slate-900 to-neon-gold/50">
                        {evt.imageUrl ? (
                          <img
                            src={evt.imageUrl}
                            alt={evt.title}
                            className="h-full w-full object-contain transition-transform duration-700 group-hover:scale-110"
                            loading="lazy"
                          />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center">
                            <Calendar className="h-16 w-16 text-white/60" />
                          </div>
                        )}
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
                            {formatDate(evt.startDatetime, { weekday: 'short' })}
                          </span>
                          {evt.location && (
                            <span className="inline-flex items-center gap-1.5">
                              <MapPin className="h-4 w-4 text-neon-gold" />
                              <span className="truncate max-w-[160px]">{evt.location}</span>
                            </span>
                          )}
                        </div>
                        <div className="mt-4">
                          <span className="btn-primary inline-flex items-center gap-2 px-4 py-2 text-sm">
                            {t('viewInfo')}
                            <ArrowRight className="h-4 w-4" />
                          </span>
                        </div>
                      </div>
                    </div>
                  </Link>
                </FadeIn>
              ))}
            </div>
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
              <FadeIn className="inline-flex items-center gap-2 rounded-full border border-rose-400/30 bg-rose-500/10 px-3 py-1 text-xs font-semibold text-rose-500">
                <Heart className="h-3.5 w-3.5" />
                {t('activeFundraisersTag')}
              </FadeIn>
              <h2 className="section-title mt-3">{t('fundraisersTitle')}</h2>
              <p className="mt-2 max-w-2xl text-slate-700 dark:text-slate-400">{t('fundraisersDesc')}</p>
            </div>
            <Link href="/fundraisers" className="hidden text-sm font-semibold text-neon-blue sm:inline-flex">
              {t('viewAllFundraisers')} <ArrowRight className="ml-1 h-4 w-4" />
            </Link>
          </div>

          {fundraisers.length === 0 ? (
            <p className="text-slate-600 dark:text-slate-400">{t('noActiveFundraisers')}</p>
          ) : (
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {fundraisers.map((f, idx) => {
                const progress = f.targetAmount > 0 ? Math.min((f.raisedAmount / f.targetAmount) * 100, 100) : 0;
                return (
                  <FadeIn key={f.id} delay={idx * 0.08}>
                    <Link href={`/fundraisers/${f.id}`}>
                      <div className="glass-card group flex h-full flex-col overflow-hidden transition-transform duration-300 hover:-translate-y-2">
                        <div className="relative aspect-video overflow-hidden bg-gradient-to-br from-rose-500/50 via-slate-900 to-neon-blue/50">
                          {f.imageUrl ? (
                            <img
                              src={f.imageUrl}
                              alt={f.title}
                              className="h-full w-full object-contain transition-transform duration-700 group-hover:scale-110"
                              loading="lazy"
                            />
                          ) : (
                            <div className="flex h-full w-full items-center justify-center">
                              <Heart className="h-16 w-16 text-white/60" />
                            </div>
                          )}
                        </div>
                        <div className="flex flex-1 flex-col p-5">
                          <h3 className="text-lg font-bold transition-colors group-hover:text-rose-500">{f.title}</h3>
                          <p className="mt-2 line-clamp-2 flex-1 text-sm text-slate-700 dark:text-slate-400">
                            {f.description ?? ''}
                          </p>
                          <div className="mt-4">
                            <ProgressBar progress={progress} />
                            <div className="mt-2 flex justify-between text-sm">
                              <span className="font-medium text-rose-500">{t('raised', { amount: formatCurrency(f.raisedAmount) })}</span>
                              <span className="text-slate-600 dark:text-slate-400">{t('goal', { amount: formatCurrency(f.targetAmount) })}</span>
                            </div>
                          </div>
                          <div className="mt-4">
                            <span className="btn-primary inline-flex items-center gap-2 px-4 py-2 text-sm">
                              {tCommon('learnMore')}
                              <ArrowRight className="h-4 w-4" />
                            </span>
                          </div>
                        </div>
                      </div>
                    </Link>
                  </FadeIn>
                );
              })}
            </div>
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
              <FadeIn className="inline-flex items-center gap-2 rounded-full border border-neon-gold/30 bg-neon-gold/10 px-3 py-1 text-xs font-semibold text-amber-700 dark:text-neon-gold">
                <Store className="h-3.5 w-3.5" />
                {t('localBusinessesTag')}
              </FadeIn>
              <h2 className="section-title mt-3">{t('localBusinessesTitle')}</h2>
              <p className="mt-2 max-w-2xl text-slate-700 dark:text-slate-400">{t('localBusinessesDesc')}</p>
            </div>
            <Link href="/directory" className="hidden text-sm font-semibold text-neon-blue sm:inline-flex">
              {t('viewAllBusinesses')} <ArrowRight className="ml-1 h-4 w-4" />
            </Link>
          </div>
        </div>

        {businesses.length === 0 ? (
          <div className="mx-auto max-w-7xl">
            <p className="text-slate-600 dark:text-slate-400">{t('noBusinesses')}</p>
          </div>
        ) : (
          <div className="relative">
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

          {visibleBlogPosts.length === 0 ? (
            <p className="text-slate-600 dark:text-slate-400">{t('noBlogPosts')}</p>
          ) : (
            <div className="overflow-hidden">
              <div
                className="flex gap-6 transition-transform duration-500 ease-out"
                style={{ transform: `translateX(-${blogIndex * (100 / blogsPerPage)}%)` }}
              >
                {visibleBlogPosts.map((post) => {
                  const isFacebook = post.type === 'facebook';
                  const href = isFacebook ? post.url : `/blog/${post.slug}`;
                  const linkProps = isFacebook
                    ? { href, target: '_blank', rel: 'noopener noreferrer' }
                    : { href };
                  const LinkComponent = isFacebook ? 'a' : Link;
                  const summary = isFacebook
                    ? (post.content ? summarizeRichText(post.content, 160) : t('blogFallback'))
                    : (post.aiTldr ? summarizeRichText(post.aiTldr, 160) : t('blogFallback'));

                  return (
                    <div
                      key={post.id}
                      className="w-full flex-shrink-0 md:w-[calc(33.333%-1rem)]"
                    >
                      <LinkComponent {...linkProps}>
                        <div className="glass-card group h-full overflow-hidden p-0 transition-transform duration-300 hover:-translate-y-1.5">
                          <div className="relative aspect-video overflow-hidden">
                            <div
                              className={`h-full w-full bg-gradient-to-br transition-transform duration-700 group-hover:scale-110 ${isFacebook ? 'from-blue-600/40 to-blue-400/40' : 'from-neon-purple/40 to-neon-blue/40'}`}
                              style={post.imageUrl ? { backgroundImage: `url(${post.imageUrl})`, backgroundSize: 'cover' } : undefined}
                            />
                          </div>
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
                              <p className="mt-4 text-xs text-slate-600 dark:text-slate-400">{formatDate(post.publishedAt, { weekday: 'short' })}</p>
                            )}
                          </div>
                        </div>
                      </LinkComponent>
                    </div>
                  );
                })}
              </div>
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
              <FadeIn className="inline-flex items-center gap-2 rounded-full border border-neon-blue/30 bg-neon-blue/10 px-3 py-1 text-xs font-semibold text-neon-blue">
                <MessageCircle className="h-3.5 w-3.5" />
                {t('startConversationTag')}
              </FadeIn>
              <h2 className="section-title mt-3">{t('startConversationTitle')}</h2>
              <p className="mt-2 max-w-2xl text-slate-700 dark:text-slate-400">{t('startConversationDesc')}</p>
            </div>
            <Link href="/forum" className="hidden text-sm font-semibold text-neon-blue sm:inline-flex">
              {t('visitForum')} <ArrowRight className="ml-1 h-4 w-4" />
            </Link>
          </div>

          {forumCategories.length === 0 ? (
            <p className="text-slate-600 dark:text-slate-400">{t('noCategories')}</p>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {forumCategories.map((category, idx) => (
                <FadeIn key={category.id} delay={idx * 0.08}>
                  <Link href={`/forum/categories/${category.id}`}>
                    <div className="glass-card group relative overflow-hidden p-5 transition-transform duration-300 hover:-translate-y-1 hover:scale-[1.02]">
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
                    </div>
                  </Link>
                </FadeIn>
              ))}
            </div>
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
