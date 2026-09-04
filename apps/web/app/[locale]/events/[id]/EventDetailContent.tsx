'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Calendar, Clock, MapPin, Loader2, Minus, Plus, Ticket, ArrowLeft } from 'lucide-react';
import { Link } from '@/i18n/routing';
import { api } from '@/lib/api';
import { formatDate, formatCurrency, cn } from '@/lib/utils';
import { useAuth } from '@/hooks/useAuth';
import { usePaymentSettings } from '@/hooks/usePaymentSettings';
import { RichTextContent } from '@/components/ui/RichTextContent';
import { ShareButtons } from '@/components/ui/ShareButtons';
import { usePhotoLightbox } from '@/components/ui/PhotoLightbox';
import EventLocationLink from '@/components/events/EventLocationLink';
import AddToCalendar from '@/components/events/AddToCalendar';
import { calculateProcessingFee, EventCategory, eventCategoryLabels, eventCategoryColors } from '@kentslsc/shared';

export interface Event {
  id: string;
  title: string;
  description?: string;
  location?: string;
  startDatetime: string;
  endDatetime: string;
  ticketPrice: number;
  isFree: boolean;
  maxTickets?: number;
  category?: EventCategory;
  imageUrl?: string;
  posterImageUrl?: string | null;
  posterImages?: { url: string; caption?: string }[] | null;
  isPublished: boolean;
  tickets?: { id: string }[];
  _count?: { tickets: number };
  externalTicketingUrl?: string | null;
  createdAt: string;
  updatedAt: string;
}

interface Props {
  id: string;
  event?: Event;
  shareUrl?: string;
}

export default function EventDetailContent({ id, event: initialEvent, shareUrl }: Props) {
  const router = useRouter();
  const { data: user, isLoading: authLoading } = useAuth();
  const { data: paymentSettings } = usePaymentSettings();
  const t = useTranslations('eventDetail');
  const tCommon = useTranslations('common');
  const [quantity, setQuantity] = useState(1);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const { data: event, isLoading } = useQuery<Event>({
    queryKey: ['events', id],
    queryFn: async () => {
      const { data } = await api.get<Event>(`/events/${id}`);
      return data;
    },
    initialData: initialEvent,
    enabled: !!id
  });

  const purchase = useMutation({
    mutationFn: async () => {
      if (!event) throw new Error('Event not loaded');
      const { data } = await api.post<{ free: boolean; tickets?: { id: string }[]; url?: string; sessionId?: string; clientSecret?: string; provider?: 'stripe' | 'gocardless' }>(
        `/events/${event.id}/tickets/purchase`,
        { eventId: event.id, quantity }
      );
      return data;
    },
    onSuccess: (data) => {
      if (data.free) {
        setMessage({ type: 'success', text: t('reserveSuccess') });
        setTimeout(() => router.push('/dashboard/tickets'), 1500);
      } else if (data.provider === 'gocardless' && data.url) {
        window.location.assign(data.url);
      } else if (data.clientSecret && data.sessionId) {
        router.push(`/checkout?session_id=${data.sessionId}&client_secret=${encodeURIComponent(data.clientSecret)}`);
      } else if (data.url) {
        window.location.href = data.url;
      }
    },
    onError: (err: { response?: { data?: { message?: string } }; message?: string }) => {
      const text = err.response?.data?.message || err.message || t('purchaseFailed');
      setMessage({ type: 'error', text });
    }
  });

  const externalTicketClick = useMutation({
    mutationFn: async () => {
      if (!event) throw new Error('Event not loaded');
      const { data } = await api.post<{ url: string }>(`/events/${event.id}/external-ticket-click`, {});
      return data;
    },
    onSuccess: (data) => {
      window.location.href = data.url;
    },
    onError: (err: { response?: { data?: { message?: string } }; message?: string }) => {
      const text = err.response?.data?.message || err.message || t('purchaseFailed');
      setMessage({ type: 'error', text });
    }
  });

  const handleBuy = () => {
    if (!event) return;
    if (event.externalTicketingUrl) {
      externalTicketClick.mutate();
      return;
    }
    if (!user) {
      router.push(`/auth/login?returnTo=/events/${event.id}`);
      return;
    }
    purchase.mutate();
  };

  const remaining =
    event && typeof event.maxTickets === 'number' && typeof event._count?.tickets === 'number'
      ? event.maxTickets - event._count.tickets
      : null;

  const hasCapacity = remaining === null || remaining > 0;
  const canSelectQuantity = hasCapacity && quantity <= (remaining ?? 10);
  const isFree = event?.isFree || Number(event?.ticketPrice) === 0;
  const subtotal = isFree ? 0 : Number(event?.ticketPrice) * quantity;

  const feeBreakdown = useMemo(() => {
    if (isFree || subtotal <= 0 || !paymentSettings) return null;
    return calculateProcessingFee(Math.round(subtotal * 100), {
      enabled: paymentSettings.processingFeeEnabled,
      percent: paymentSettings.processingFeePercent,
      fixed: paymentSettings.processingFeeFixed
    });
  }, [subtotal, isFree, paymentSettings]);

  const total = feeBreakdown ? feeBreakdown.gross / 100 : subtotal;
  const isExternal = !!event?.externalTicketingUrl;

  const posterPhotos = useMemo(
    () => (event?.posterImages ?? []).map((p, i) => ({ id: `poster-${i}`, url: p.url, caption: p.caption })),
    [event?.posterImages]
  );
  const { open, Lightbox } = usePhotoLightbox(posterPhotos);

  if (isLoading || authLoading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-neon-blue" />
      </div>
    );
  }

  if (!event) {
    return (
      <div className="px-4 py-16 text-center md:px-6">
        <h1 className="text-2xl font-bold">{t('notFoundTitle')}</h1>
        <Link href="/events" className="btn-primary mt-6 inline-block">
          {t('notFoundCta')}
        </Link>
      </div>
    );
  }

  // The database stores datetimes as UTC, but event times are intended as local
  // UK wall-clock times. Parse the ISO string directly so the displayed time
  // matches what was entered in the admin form (and the poster/description).
  function parseWallClock(isoString: string) {
    const [datePart = '', timePart = ''] = isoString.split('T');
    const [year = 0, month = 1, day = 1] = datePart.split('-').map(Number);
    const [hour = 0, minute = 0] = timePart.split(':').map(Number);
    return { year, month, day, hour, minute };
  }

  const start = parseWallClock(event.startDatetime);
  const end = parseWallClock(event.endDatetime);
  const startDateObj = new Date(start.year, start.month - 1, start.day);
  const monthNames = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const weekdayNames = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
  const monthShort = monthNames[start.month - 1]!;
  const weekdayLong = weekdayNames[startDateObj.getDay()]!;
  const dayNumber = start.day;
  const timeRange = `${String(start.hour).padStart(2, '0')}:${String(start.minute).padStart(2, '0')} – ${String(end.hour).padStart(2, '0')}:${String(end.minute).padStart(2, '0')}`;
  const fullDate = `${weekdayNames[startDateObj.getDay()]!}, ${start.day} ${monthNames[start.month - 1]!} ${start.year}`;

  return (
    <div className="px-4 py-12 md:px-6">
      <div className="mx-auto max-w-7xl">
        <Link href="/events" className="inline-flex items-center gap-2 text-sm text-slate-600 hover:text-neon-blue dark:text-slate-400">
          <ArrowLeft className="h-4 w-4" /> {t('backToEvents')}
        </Link>

        <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-[minmax(300px,420px)_1fr]">
          {/* Left column: poster, location, share, description, extra posters */}
          <div className="space-y-6">
            <div className="glass-card overflow-hidden">
              {(event.imageUrl || event.posterImageUrl) ? (
                <img
                  src={event.imageUrl || event.posterImageUrl || undefined}
                  alt={event.title}
                  className="h-auto max-h-[45vh] w-full object-contain md:max-h-none"
                />
              ) : (
                <div className="flex aspect-[3/2] w-full items-center justify-center bg-gradient-to-br from-neon-blue/30 to-neon-gold/30">
                  <Ticket className="h-16 w-16 text-white/20" />
                </div>
              )}
            </div>

            {event.location && (
              <div className="glass-card p-6">
                <h2 className="mb-3 flex items-center gap-2 text-lg font-semibold">
                  <MapPin className="h-5 w-5 text-neon-blue" />
                  {t('locationTitle')}
                </h2>
                <EventLocationLink location={event.location} className="text-base" />
              </div>
            )}

            {shareUrl && (
              <div className="glass-card p-6">
                <ShareButtons
                  url={shareUrl}
                  title={event.title}
                  heading={t('shareTitle')}
                  shareText={t('shareText', { title: event.title })}
                  copyLabel={tCommon('copyLink')}
                  copiedLabel={tCommon('copied')}
                />
              </div>
            )}

            {event.description && (
              <div className="glass-card p-6 md:p-8">
                <RichTextContent html={event.description} className="text-slate-700 dark:text-slate-300" />
              </div>
            )}

            {posterPhotos.length > 0 && (
              <div className="glass-card p-6">
                <h2 className="mb-4 text-lg font-semibold">{t('postersTitle')}</h2>
                <div className="grid gap-4 sm:grid-cols-2">
                  {posterPhotos.map((poster, idx) => (
                    <button
                      key={poster.id}
                      type="button"
                      onClick={() => open(idx)}
                      className="overflow-hidden rounded-xl border border-white/10 bg-white/5 text-left"
                    >
                      <img
                        src={poster.url}
                        alt={poster.caption || `${event.title} poster ${idx + 1}`}
                        className="h-auto w-full object-contain"
                      />
                      {poster.caption && (
                        <p className="p-3 text-xs text-slate-500 dark:text-slate-400">{poster.caption}</p>
                      )}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Right column: title, big date, add to calendar, tickets — sticky on desktop */}
          <aside className="space-y-6 lg:sticky lg:top-8 lg:self-start">
            <div className="glass-card p-5 md:p-6">
              {event.category && (
                <span
                  className={cn(
                    'mb-4 inline-flex rounded-full px-3 py-1 text-sm font-medium',
                    eventCategoryColors[event.category]
                  )}
                >
                  {eventCategoryLabels[event.category]}
                </span>
              )}

              <h1 className="text-3xl font-bold md:text-4xl">{event.title}</h1>

              <div className="mt-6 flex items-stretch gap-4">
                <div className="flex min-w-[90px] flex-col items-center justify-center rounded-2xl bg-gradient-to-br from-neon-blue to-emerald-600 px-4 py-5 text-center text-white shadow-neon">
                  <span className="text-xs font-bold uppercase tracking-widest">{monthShort}</span>
                  <span className="text-5xl font-bold leading-none md:text-6xl">{dayNumber}</span>
                  <span className="mt-1 text-xs font-medium uppercase">{weekdayLong}</span>
                </div>
                <div className="flex flex-col justify-center gap-1.5">
                  <div className="flex items-center gap-2 text-lg font-semibold">
                    <Calendar className="h-5 w-5 text-neon-blue" />
                    {fullDate}
                  </div>
                  <div className="flex items-center gap-2 text-slate-600 dark:text-slate-400">
                    <Clock className="h-4 w-4 text-neon-blue" />
                    {timeRange}
                  </div>
                  {event.location && (
                    <div className="flex items-start gap-2 text-sm">
                      <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-neon-blue" />
                      <EventLocationLink location={event.location} />
                    </div>
                  )}
                </div>
              </div>

              <div className="mt-5">
                <AddToCalendar
                  event={{
                    id: event.id,
                    title: event.title,
                    description: event.description,
                    location: event.location,
                    startDatetime: event.startDatetime,
                    endDatetime: event.endDatetime
                  }}
                />
              </div>

              <div className="mt-6 flex flex-col gap-4 rounded-2xl bg-white/5 p-4 dark:bg-black/20">
                {isExternal ? (
                  <p className="text-sm text-slate-600 dark:text-slate-400">{t('externalTicketsNote')}</p>
                ) : (
                  <>
                    <div className="flex items-center justify-between">
                      <span className="text-lg font-semibold">
                        {t('priceEach', { price: isFree ? t('freeTicket') : formatCurrency(Number(event.ticketPrice)) })}
                      </span>
                      {remaining !== null && (
                        <span className={cn('text-sm', remaining <= 5 ? 'text-red-500' : 'text-slate-500')}>
                          {t('remaining', { count: remaining })}
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-4">
                      <span className="text-sm font-medium">{t('quantity')}</span>
                      <div className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/5 p-1 dark:bg-black/20">
                        <button
                          type="button"
                          disabled={quantity <= 1}
                          onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                          className="rounded-lg p-2 hover:bg-white/10 disabled:opacity-40"
                        >
                          <Minus className="h-4 w-4" />
                        </button>
                        <span className="w-8 text-center font-semibold">{quantity}</span>
                        <button
                          type="button"
                          disabled={!hasCapacity || quantity >= (remaining ?? 10) || quantity >= 10}
                          onClick={() => setQuantity((q) => Math.min(10, q + 1))}
                          className="rounded-lg p-2 hover:bg-white/10 disabled:opacity-40"
                        >
                          <Plus className="h-4 w-4" />
                        </button>
                      </div>
                    </div>

                    {!isFree && feeBreakdown && feeBreakdown.fee > 0 && (
                      <div className="space-y-1 text-sm">
                        <div className="flex justify-between text-slate-600 dark:text-slate-400">
                          <span>{tCommon('tickets')}</span>
                          <span>{formatCurrency(feeBreakdown.net / 100)}</span>
                        </div>
                        <div className="flex justify-between text-slate-600 dark:text-slate-400">
                          <span>{tCommon('processingFee')}</span>
                          <span>{formatCurrency(feeBreakdown.fee / 100)}</span>
                        </div>
                        <div className="flex justify-between border-t border-white/10 pt-1 font-semibold">
                          <span>{tCommon('total')}</span>
                          <span>{formatCurrency(feeBreakdown.gross / 100)}</span>
                        </div>
                      </div>
                    )}
                  </>
                )}

                {message && (
                  <div
                    className={cn(
                      'rounded-xl p-3 text-sm',
                      message.type === 'success'
                        ? 'bg-green-500/10 text-green-600 dark:text-green-400'
                        : 'bg-red-500/10 text-red-600 dark:text-red-400'
                    )}
                  >
                    {message.text}
                  </div>
                )}

                {isExternal ? (
                  <button
                    onClick={handleBuy}
                    disabled={externalTicketClick.isPending}
                    className="btn-primary w-full"
                  >
                    {externalTicketClick.isPending ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <Ticket className="mr-2 h-4 w-4" />
                    )}
                    {t('getTicketsExternal')}
                  </button>
                ) : user ? (
                  <button
                    onClick={handleBuy}
                    disabled={purchase.isPending || !hasCapacity || !canSelectQuantity}
                    className="btn-primary w-full"
                  >
                    {purchase.isPending ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <Ticket className="mr-2 h-4 w-4" />
                    )}
                    {isFree ? t('reserveTickets') : t('buyFor', { amount: formatCurrency(total) })}
                  </button>
                ) : (
                  <button onClick={handleBuy} className="btn-primary w-full">
                    <Ticket className="mr-2 h-4 w-4" /> {t('loginToBuy')}
                  </button>
                )}
              </div>
            </div>
          </aside>
        </div>
      </div>
      <Lightbox />
    </div>
  );
}
