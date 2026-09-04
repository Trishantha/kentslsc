'use client';

import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useForm, Controller } from 'react-hook-form';
import { useEffect, useMemo, useState } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  businessListingSchema,
  jobAdSchema,
  directoryCategoryGroups,
  getDirectoryCategoryLabel,
  calculateProcessingFee
} from '@kentslsc/shared';
import { api } from '@/lib/api';
import { inferPaymentProvider } from '@/lib/payments';
import { useAuth } from '@/hooks/useAuth';
import { usePaymentSettings } from '@/hooks/usePaymentSettings';
import { formatDate, formatCurrency } from '@/lib/utils';
import {
  MapPin,
  Phone,
  Mail,
  Globe,
  Crown,
  Briefcase,
  Loader2,
  ArrowLeft,
  Sparkles,
  Plus,
  Trash2,
  X,
  Navigation,
  ExternalLink
} from 'lucide-react';
import { Link } from '@/i18n/routing';
import SearchableSelect from '@/components/ui/SearchableSelect';
import { RichTextContent } from '@/components/ui/RichTextContent';
import { SocialLinks } from '@/components/layout/SocialLinks';

const updateBusinessSchema = businessListingSchema.partial();
const createJobSchema = jobAdSchema.extend({
  businessListingId: z.string().uuid()
});

type UpdateBusinessInput = z.infer<typeof updateBusinessSchema>;
type CreateJobInput = z.infer<typeof createJobSchema>;

interface Job {
  id: string;
  businessListingId?: string;
  title: string;
  description?: string;
  location?: string;
  salaryRange?: string;
  contactEmail?: string;
  closingDate?: string;
  isPublished: boolean;
  createdAt: string;
}

export interface Business {
  id: string;
  ownerUserId: string;
  businessName: string;
  logoUrl?: string;
  description?: string;
  servicesText?: string;
  websiteUrl?: string;
  email?: string;
  phone?: string;
  address?: string;
  category?: string;
  facebook?: string;
  instagram?: string;
  twitter?: string;
  youtube?: string;
  linkedin?: string;
  tiktok?: string;
  isPaid: boolean;
  isPromoted: boolean;
  promotedUntil?: string;
  createdAt: string;
  updatedAt: string;
  jobAds: Job[];
  owner: { id: string; name: string };
}

interface Props {
  id: string;
  business?: Business;
}

const inputClass =
  'mt-1 w-full rounded-lg border border-white/10 bg-white/10 px-4 py-2.5 text-sm outline-none placeholder:text-slate-400';

const PROMOTION_PRICE_PENCE = 2500;

const categorySelectGroups = directoryCategoryGroups.map((group) => ({
  name: group.name,
  emoji: group.emoji,
  options: group.subcategories.map((sub) => ({ value: sub.name, label: sub.name }))
}));

export default function DirectoryDetailContent({ id, business: initialBusiness }: Props) {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const resolvedId = id || params?.id || '';
  const queryClient = useQueryClient();
  const { data: user } = useAuth();
  const { data: paymentSettings } = usePaymentSettings();
  const t = useTranslations('directoryDetail');
  const tDirectory = useTranslations('directory');
  const tCommon = useTranslations('common');
  const searchParams = useSearchParams();
  const [showPromotedBanner, setShowPromotedBanner] = useState(searchParams?.get('promoted') === 'success');

  const confirmDirectoryPayment = useMutation({
    mutationFn: async ({ sessionId, provider }: { sessionId: string; provider: string }) => {
      const res = await api.post('/payments/confirm-session', { sessionId, provider });
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['directory', 'businesses', resolvedId] });
    }
  });

  useEffect(() => {
    const sessionId = searchParams?.get('session_id');
    const provider = searchParams?.get('provider') ?? (sessionId ? inferPaymentProvider(sessionId) : 'stripe');
    const promoted = searchParams?.get('promoted');
    const jobPublished = searchParams?.get('jobPublished');
    if (sessionId && !confirmDirectoryPayment.isPending && (promoted === 'success' || jobPublished === 'success')) {
      confirmDirectoryPayment.mutate({ sessionId, provider });
    }
  }, [searchParams, confirmDirectoryPayment]);

  const promotionFee = useMemo(() => {
    if (!paymentSettings) return null;
    return calculateProcessingFee(PROMOTION_PRICE_PENCE, {
      enabled: paymentSettings.processingFeeEnabled,
      percent: paymentSettings.processingFeePercent,
      fixed: paymentSettings.processingFeeFixed
    });
  }, [paymentSettings]);

  const { data: business, isLoading } = useQuery<Business>({
    queryKey: ['directory', 'businesses', resolvedId],
    queryFn: async () => {
      const { data } = await api.get(`/directory/businesses/${resolvedId}`);
      return data;
    },
    initialData: initialBusiness,
    enabled: !!resolvedId
  });

  const canManage =
    user && business && (user.role === 'ADMIN' || user.id === business.ownerUserId);
  const isBusinessOwner = user?.role === 'BUSINESS_OWNER' || user?.role === 'ADMIN';

  const updateForm = useForm<UpdateBusinessInput>({
    resolver: zodResolver(updateBusinessSchema),
    values: business
      ? {
          businessName: business.businessName,
          logoUrl: business.logoUrl,
          description: business.description,
          servicesText: business.servicesText,
          websiteUrl: business.websiteUrl,
          email: business.email,
          phone: business.phone,
          address: business.address,
          category: business.category,
          facebook: business.facebook,
          instagram: business.instagram,
          twitter: business.twitter,
          youtube: business.youtube,
          linkedin: business.linkedin,
          tiktok: business.tiktok,
          isPaid: business.isPaid
        }
      : undefined
  });

  const jobForm = useForm<CreateJobInput>({
    resolver: zodResolver(createJobSchema),
    defaultValues: { businessListingId: resolvedId }
  });

  const updateBusiness = useMutation({
    mutationFn: (data: UpdateBusinessInput) =>
      api.put(`/directory/businesses/${resolvedId}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['directory', 'businesses', resolvedId] });
      queryClient.invalidateQueries({ queryKey: ['directory', 'businesses'] });
    }
  });

  const deleteBusiness = useMutation({
    mutationFn: () => api.delete(`/directory/businesses/${resolvedId}`),
    onSuccess: () => {
      window.location.href = '/directory';
    }
  });

  const createJob = useMutation({
    mutationFn: (data: CreateJobInput) => api.post('/directory/jobs', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['directory', 'businesses', resolvedId] });
      queryClient.invalidateQueries({ queryKey: ['directory', 'jobs'] });
      jobForm.reset({ businessListingId: resolvedId });
    }
  });

  const deleteJob = useMutation({
    mutationFn: (jobId: string) => api.delete(`/directory/jobs/${jobId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['directory', 'businesses', resolvedId] });
      queryClient.invalidateQueries({ queryKey: ['directory', 'jobs'] });
    }
  });

  const promote = useMutation({
    mutationFn: () => api.post<{ clientSecret?: string; sessionId?: string; url?: string; provider?: 'stripe' | 'gocardless' }>(`/directory/businesses/${resolvedId}/promote`),
    onSuccess: (res) => {
      if (res.data.provider === 'gocardless' && res.data.url) {
        window.location.assign(res.data.url);
        return;
      }
      if (res.data.clientSecret && res.data.sessionId) {
        router.push(`/checkout?session_id=${res.data.sessionId}&client_secret=${encodeURIComponent(res.data.clientSecret)}`);
        return;
      }
      if (res.data.url) {
        window.location.href = res.data.url;
      }
    }
  });

  if (isLoading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-neon-blue" />
      </div>
    );
  }

  if (!business) {
    return (
      <div className="px-4 py-16 text-center md:px-6">
        <p className="text-slate-600 dark:text-slate-400">{t('notFound')}</p>
        <Link href="/directory" className="btn-primary mt-4 inline-block">
          {t('backToDirectory')}
        </Link>
      </div>
    );
  }

  return (
    <div className="px-4 py-12 md:px-6">
      <div className="mx-auto max-w-5xl">
        <Link
          href="/directory"
          className="inline-flex items-center gap-2 text-sm font-medium text-slate-600 hover:text-neon-blue dark:text-slate-400"
        >
          <ArrowLeft className="h-4 w-4" /> {t('backToDirectory')}
        </Link>

        {showPromotedBanner && (
          <div className="mt-4 flex items-start justify-between rounded-xl border border-neon-gold/20 bg-neon-gold/10 p-4">
            <div className="flex items-center gap-2 text-sm font-medium text-amber-900 dark:text-neon-gold">
              <Crown className="h-4 w-4" />
              {t('promotionSuccess')}
            </div>
            <button
              onClick={() => setShowPromotedBanner(false)}
              className="rounded p-1 text-slate-500 hover:bg-white/10"
              aria-label="Dismiss"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        )}

        <div className="mt-6 glass-card overflow-hidden p-0">
          {/* Hero header with crisp logo and primary actions */}
          <div className="relative p-6 md:p-8">
            <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
              <div className="flex flex-col gap-5 sm:flex-row sm:items-start">
                {business.logoUrl ? (
                  <div className="shrink-0 rounded-2xl border border-slate-200 bg-white p-2 shadow-sm dark:border-white/10 dark:bg-white">
                    <img
                      src={business.logoUrl}
                      alt={business.businessName}
                      className="h-24 w-24 object-contain sm:h-28 sm:w-28"
                    />
                  </div>
                ) : (
                  <div className="flex h-24 w-24 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-neon-gold to-amber-500 sm:h-28 sm:w-28">
                    <span className="text-2xl font-bold text-amber-950">
                      {business.businessName.charAt(0).toUpperCase()}
                    </span>
                  </div>
                )}
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h1 className="text-2xl font-bold sm:text-3xl">{business.businessName}</h1>
                    {business.isPromoted && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-neon-gold/10 px-2.5 py-1 text-xs font-medium text-neon-gold">
                        <Crown className="h-3 w-3" /> {tDirectory('promoted')}
                      </span>
                    )}
                  </div>
                  {business.category && (
                    <p className="mt-1 text-sm font-medium text-neon-blue">
                      {getDirectoryCategoryLabel(business.category)}
                    </p>
                  )}
                  <div className="mt-4 flex flex-wrap gap-2 text-xs text-slate-600 dark:text-slate-400">
                    {business.address && (
                      <a
                        href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(business.address)}`}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-slate-100/50 px-2.5 py-1 transition-colors hover:border-neon-blue/30 hover:text-neon-blue dark:border-white/10 dark:bg-white/5"
                      >
                        <MapPin className="h-3.5 w-3.5 text-neon-blue" /> {business.address}
                      </a>
                    )}
                    {business.phone && (
                      <a
                        href={`tel:${business.phone.replace(/\s/g, '')}`}
                        className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-slate-100/50 px-2.5 py-1 transition-colors hover:border-neon-blue/30 hover:text-neon-blue dark:border-white/10 dark:bg-white/5"
                      >
                        <Phone className="h-3.5 w-3.5 text-neon-blue" /> {business.phone}
                      </a>
                    )}
                    {business.email && (
                      <a
                        href={`mailto:${business.email}`}
                        className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-slate-100/50 px-2.5 py-1 transition-colors hover:border-neon-blue/30 hover:text-neon-blue dark:border-white/10 dark:bg-white/5"
                      >
                        <Mail className="h-3.5 w-3.5 text-neon-blue" /> {business.email}
                      </a>
                    )}
                    {business.websiteUrl && (
                      <a
                        href={business.websiteUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-slate-100/50 px-2.5 py-1 transition-colors hover:border-neon-blue/30 hover:text-neon-blue dark:border-white/10 dark:bg-white/5"
                      >
                        <Globe className="h-3.5 w-3.5 text-neon-blue" /> {t('website')}
                      </a>
                    )}
                  </div>

                  {(business.facebook || business.instagram || business.twitter || business.youtube || business.linkedin || business.tiktok) && (
                    <SocialLinks
                      links={business}
                      className="mt-4 flex flex-wrap gap-2"
                      iconSize="sm"
                    />
                  )}
                </div>
              </div>

              {canManage && (
                <div className="flex flex-col gap-2 lg:items-end">
                  {promotionFee && promotionFee.fee > 0 && (
                    <div className="text-xs text-slate-500 lg:text-right">
                      <span>{formatCurrency(promotionFee.net / 100)} + {formatCurrency(promotionFee.fee / 100)} fee = </span>
                      <span className="font-semibold text-slate-700 dark:text-slate-300">{formatCurrency(promotionFee.gross / 100)}</span>
                    </div>
                  )}
                  <div className="flex flex-wrap gap-2">
                    <button
                      onClick={() => promote.mutate()}
                      disabled={promote.isPending}
                      className="btn-primary inline-flex items-center gap-2"
                    >
                      <Crown className="h-4 w-4" />
                      {promote.isPending ? tCommon('loading') : t('promote30Days')}
                    </button>
                    <button
                      onClick={() => deleteBusiness.mutate()}
                      disabled={deleteBusiness.isPending}
                      className="inline-flex items-center gap-2 rounded-lg bg-red-500/10 px-4 py-2 text-sm font-medium text-red-500 hover:bg-red-500/20"
                    >
                      <Trash2 className="h-4 w-4" /> {t('delete')}
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Primary action buttons */}
            <div className="mt-6 flex flex-wrap gap-3 border-t border-white/10 pt-6">
              {business.address && (
                <a
                  href={`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(business.address)}`}
                  target="_blank"
                  rel="noreferrer"
                  className="btn-primary inline-flex items-center gap-2"
                >
                  <Navigation className="h-4 w-4" />
                  {t('getDirections')}
                </a>
              )}
              {business.phone && (
                <a
                  href={`tel:${business.phone.replace(/\s/g, '')}`}
                  className="btn-secondary inline-flex items-center gap-2"
                >
                  <Phone className="h-4 w-4" />
                  {t('callNow')}
                </a>
              )}
              {business.websiteUrl && (
                <a
                  href={business.websiteUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/10 px-5 py-2.5 text-sm font-semibold text-slate-700 transition-colors hover:bg-neon-blue hover:text-white dark:text-slate-200"
                >
                  <ExternalLink className="h-4 w-4" />
                  {t('visitWebsite')}
                </a>
              )}
              {business.email && (
                <a
                  href={`mailto:${business.email}`}
                  className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/10 px-5 py-2.5 text-sm font-semibold text-slate-700 transition-colors hover:bg-neon-blue hover:text-white dark:text-slate-200"
                >
                  <Mail className="h-4 w-4" />
                  {t('emailBusiness')}
                </a>
              )}
            </div>
          </div>

          {/* About / Services */}
          <div className="grid gap-px border-t border-white/10 bg-white/10 md:grid-cols-2">
            <div className="bg-slate-50/50 p-6 dark:bg-slate-950/30 md:p-8">
              <h2 className="flex items-center gap-2 text-lg font-bold">
                <Sparkles className="h-4 w-4 text-neon-gold" /> {t('about')}
              </h2>
              <p className="mt-3 whitespace-pre-line leading-relaxed text-slate-600 dark:text-slate-400">
                {business.description || t('noDescription')}
              </p>
            </div>
            {business.servicesText ? (
              <div className="bg-slate-50/50 p-6 dark:bg-slate-950/30 md:p-8">
                <h2 className="text-lg font-bold">{t('services')}</h2>
                <p className="mt-3 whitespace-pre-line leading-relaxed text-slate-600 dark:text-slate-400">
                  {business.servicesText}
                </p>
              </div>
            ) : (
              <div className="hidden bg-slate-50/50 dark:bg-slate-950/30 md:block" />
            )}
          </div>
        </div>

        {/* Jobs section */}
        <div className="mt-8 glass-card p-6 md:p-8">
          <div className="flex items-center justify-between">
            <h2 className="flex items-center gap-2 text-xl font-bold">
              <Briefcase className="h-5 w-5" /> {t('jobsAt', { name: business.businessName })}
            </h2>
          </div>
          <div className="mt-4 space-y-4">
            {business.jobAds.length === 0 && (
              <p className="text-slate-500">{t('noJobs')}</p>
            )}
            {business.jobAds.map((job) => (
              <div
                key={job.id}
                className="flex flex-col justify-between gap-3 rounded-xl border border-white/10 bg-white/5 p-4 md:flex-row md:items-center"
              >
                <div>
                  <h3 className="font-bold">{job.title}</h3>
                  <div className="mt-1 flex flex-wrap gap-3 text-sm text-slate-500">
                    {job.location && <span>{job.location}</span>}
                    {job.salaryRange && <span>{job.salaryRange}</span>}
                    {job.closingDate && (
                      <span>{tDirectory('closes', { date: formatDate(job.closingDate) })}</span>
                    )}
                    {job.contactEmail && (
                      <a href={`mailto:${job.contactEmail}`} className="text-neon-blue hover:underline">
                        {job.contactEmail}
                      </a>
                    )}
                  </div>
                  {job.description && (
                    <RichTextContent
                      html={job.description}
                      className="mt-2 text-sm text-slate-600 dark:text-slate-400"
                    />
                  )}
                </div>
                {canManage && (
                  <button
                    onClick={() => deleteJob.mutate(job.id)}
                    disabled={deleteJob.isPending}
                    className="inline-flex items-center gap-1 self-start rounded-lg bg-red-500/10 px-3 py-1.5 text-sm text-red-500 hover:bg-red-500/20"
                  >
                    <Trash2 className="h-3.5 w-3.5" /> {t('remove')}
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>

        {canManage && (
          <div className="mt-8 grid gap-8 lg:grid-cols-2">
            <div className="glass-card p-6">
              <h3 className="text-xl font-bold">{t('editListing')}</h3>
              <form
                onSubmit={updateForm.handleSubmit((data) => updateBusiness.mutate(data))}
                className="mt-4 space-y-4"
              >
                <div>
                  <label className="text-sm font-medium">{tDirectory('listBusiness.businessName')}</label>
                  <input {...updateForm.register('businessName')} className={inputClass} />
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label className="text-sm font-medium">{tDirectory('listBusiness.category')}</label>
                    <Controller
                      name="category"
                      control={updateForm.control}
                      render={({ field }) => (
                        <SearchableSelect
                          value={field.value ?? ''}
                          onChange={field.onChange}
                          onBlur={field.onBlur}
                          groups={categorySelectGroups}
                          placeholder={tDirectory('allCategories')}
                          searchPlaceholder={tDirectory('searchPlaceholder')}
                          className="mt-1"
                        />
                      )}
                    />
                    {updateForm.formState.errors.category && (
                      <p className="mt-1 text-xs text-red-500">
                        {updateForm.formState.errors.category.message}
                      </p>
                    )}
                  </div>
                  <div>
                    <label className="text-sm font-medium">{tDirectory('listBusiness.website')}</label>
                    <input {...updateForm.register('websiteUrl')} className={inputClass} />
                  </div>
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label className="text-sm font-medium">{tDirectory('listBusiness.email')}</label>
                    <input {...updateForm.register('email')} className={inputClass} />
                  </div>
                  <div>
                    <label className="text-sm font-medium">{tDirectory('listBusiness.phone')}</label>
                    <input {...updateForm.register('phone')} className={inputClass} />
                  </div>
                </div>
                <div>
                  <label className="text-sm font-medium">{tDirectory('listBusiness.address')}</label>
                  <input {...updateForm.register('address')} className={inputClass} />
                </div>
                <div>
                  <label className="text-sm font-medium">{tDirectory('listBusiness.description')}</label>
                  <textarea
                    rows={4}
                    {...updateForm.register('description')}
                    className={`${inputClass} resize-none`}
                  />
                </div>
                <div>
                  <label className="text-sm font-medium">{t('services')}</label>
                  <textarea
                    rows={3}
                    {...updateForm.register('servicesText')}
                    className={`${inputClass} resize-none`}
                  />
                </div>
                <div className="rounded-xl border border-white/10 bg-white/5 p-4">
                  <h4 className="mb-3 text-sm font-semibold">{t('socialMedia')}</h4>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div>
                      <label className="text-xs text-slate-500">Facebook</label>
                      <input {...updateForm.register('facebook')} className={inputClass} />
                    </div>
                    <div>
                      <label className="text-xs text-slate-500">Instagram</label>
                      <input {...updateForm.register('instagram')} className={inputClass} />
                    </div>
                    <div>
                      <label className="text-xs text-slate-500">X / Twitter</label>
                      <input {...updateForm.register('twitter')} className={inputClass} />
                    </div>
                    <div>
                      <label className="text-xs text-slate-500">YouTube</label>
                      <input {...updateForm.register('youtube')} className={inputClass} />
                    </div>
                    <div>
                      <label className="text-xs text-slate-500">LinkedIn</label>
                      <input {...updateForm.register('linkedin')} className={inputClass} />
                    </div>
                    <div>
                      <label className="text-xs text-slate-500">TikTok</label>
                      <input {...updateForm.register('tiktok')} className={inputClass} />
                    </div>
                  </div>
                </div>
                <button
                  type="submit"
                  disabled={updateBusiness.isPending}
                  className="btn-primary w-full"
                >
                  {updateBusiness.isPending ? tDirectory('listBusiness.saving') : t('updateListing')}
                </button>
              </form>
            </div>

            {isBusinessOwner && (
              <div className="glass-card p-6">
                <h3 className="flex items-center gap-2 text-xl font-bold">
                  <Plus className="h-5 w-5" /> {tDirectory('postJob.title')}
                </h3>
                <form
                  onSubmit={jobForm.handleSubmit((data) => createJob.mutate(data))}
                  className="mt-4 space-y-4"
                >
                  <input type="hidden" {...jobForm.register('businessListingId')} value={resolvedId} />
                  <div>
                    <label className="text-sm font-medium">{tDirectory('postJob.jobTitle')}</label>
                    <input {...jobForm.register('title')} className={inputClass} />
                    {jobForm.formState.errors.title && (
                      <p className="mt-1 text-xs text-red-500">
                        {jobForm.formState.errors.title.message}
                      </p>
                    )}
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div>
                      <label className="text-sm font-medium">{tDirectory('postJob.location')}</label>
                      <input {...jobForm.register('location')} className={inputClass} />
                    </div>
                    <div>
                      <label className="text-sm font-medium">{tDirectory('postJob.salaryRange')}</label>
                      <input {...jobForm.register('salaryRange')} className={inputClass} />
                    </div>
                  </div>
                  <div>
                    <label className="text-sm font-medium">{tDirectory('postJob.contactEmail')}</label>
                    <input {...jobForm.register('contactEmail')} className={inputClass} />
                  </div>
                  <div>
                    <label className="text-sm font-medium">{tDirectory('postJob.description')}</label>
                    <textarea
                      rows={4}
                      {...jobForm.register('description')}
                      className={`${inputClass} resize-none`}
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      {...jobForm.register('isPublished')}
                      className="h-4 w-4 rounded border-white/10 bg-white/10"
                    />
                    <label className="text-sm font-medium">{tDirectory('postJob.publishImmediately')}</label>
                  </div>
                  <button type="submit" disabled={createJob.isPending} className="btn-primary w-full">
                    {createJob.isPending ? tDirectory('postJob.saving') : tDirectory('postJob.submit')}
                  </button>
                </form>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
