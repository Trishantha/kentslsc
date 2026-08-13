'use client';

import { useRef, useState } from 'react';
import { Link } from '@/i18n/routing';
import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  businessListingSchema,
  jobAdSchema,
  directoryCategoryGroups,
  getDirectoryCategoryLabel
} from '@kentslsc/shared';
import { api, getApiErrorMessage } from '@/lib/api';
import { useAuth } from '@/hooks/useAuth';
import { useHasFeature } from '@/hooks/useFeatures';
import { formatDate } from '@/lib/utils';
import { Search, MapPin, Briefcase, Plus, Crown, Loader2, Lock } from 'lucide-react';
import { FeatureGate } from '@/components/ui/FeatureGate';
import { ImageUpload } from '@/components/ui/ImageUpload';
import SearchableSelect from '@/components/ui/SearchableSelect';
import { MembershipFeature } from '@kentslsc/shared';

const createBusinessSchema = businessListingSchema;
const createJobSchema = jobAdSchema.extend({
  businessListingId: z.string().uuid({ message: 'Select a business' })
});

type CreateBusinessInput = z.infer<typeof createBusinessSchema>;
type CreateJobInput = z.infer<typeof createJobSchema>;

interface Business {
  id: string;
  ownerUserId: string;
  businessName: string;
  logoUrl?: string;
  description?: string;
  category?: string;
  address?: string;
  isPromoted: boolean;
  promotedUntil?: string;
  _count: { jobAds: number };
}

interface Job {
  id: string;
  title: string;
  location?: string;
  salaryRange?: string;
  closingDate?: string;
  businessListing: { id: string; businessName: string };
}

const inputClass =
  'mt-1 w-full rounded-lg border border-white/10 bg-white/10 px-4 py-2.5 text-sm outline-none placeholder:text-slate-400';

const categorySelectGroups = directoryCategoryGroups.map((group) => ({
  name: group.name,
  emoji: group.emoji,
  options: group.subcategories.map((sub) => ({ value: sub.name, label: sub.name }))
}));

export default function DirectoryPage() {
  const t = useTranslations('directory');
  const router = useRouter();
  const queryClient = useQueryClient();
  const { data: user } = useAuth();
  const canListDirectory = useHasFeature(MembershipFeature.DIRECTORY_LISTING);

  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const searchTimeoutRef = useRef<number | null>(null);

  const { data: businesses = [], isLoading: businessesLoading } = useQuery<Business[]>({
    queryKey: ['directory', 'businesses', debouncedSearch, category],
    queryFn: async () => {
      const { data } = await api.get('/directory/businesses', {
        params: { search: debouncedSearch || undefined, category: category || undefined }
      });
      return data;
    }
  });

  const { data: promotedBusinesses = [], isLoading: promotedLoading } = useQuery<Business[]>({
    queryKey: ['directory', 'businesses', 'promoted'],
    queryFn: async () => {
      const { data } = await api.get('/directory/businesses', { params: { promoted: true } });
      return data;
    }
  });

  const { data: jobs = [], isLoading: jobsLoading } = useQuery<Job[]>({
    queryKey: ['directory', 'jobs'],
    queryFn: async () => {
      const { data } = await api.get('/directory/jobs');
      return data;
    }
  });

  const businessForm = useForm<CreateBusinessInput>({
    resolver: zodResolver(createBusinessSchema)
  });
  const { setValue: setBusinessValue, watch: watchBusiness } = businessForm;
  const businessErrors = businessForm.formState.errors;

  const jobForm = useForm<CreateJobInput>({
    resolver: zodResolver(createJobSchema)
  });

  const createBusiness = useMutation({
    mutationFn: (data: CreateBusinessInput) => api.post('/directory/businesses', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['directory', 'businesses'] });
      businessForm.reset();
    }
  });

  const createJob = useMutation({
    mutationFn: (data: CreateJobInput) => api.post('/directory/jobs', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['directory', 'jobs'] });
      queryClient.invalidateQueries({ queryKey: ['directory', 'businesses'] });
      jobForm.reset();
    }
  });



  const handleSearch = (value: string) => {
    setSearch(value);
    if (searchTimeoutRef.current) {
      window.clearTimeout(searchTimeoutRef.current);
    }
    searchTimeoutRef.current = window.setTimeout(() => {
      setDebouncedSearch(value);
    }, 300);
  };

  return (
    <div className="px-4 py-16 md:px-6">
      <div className="mx-auto max-w-7xl">
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <h1 className="section-title">{t('title')}</h1>
            <p className="mt-2 text-slate-600 dark:text-slate-400">
              {t('subtitle')}
            </p>
          </div>
        </div>

        <div className="mt-8 flex flex-col gap-3 sm:flex-row">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              value={search}
              onChange={(e) => handleSearch(e.target.value)}
              placeholder={t('searchPlaceholder')}
              className="glass-card w-full pl-10 pr-4 py-3 outline-none"
            />
          </div>
          <SearchableSelect
            value={category}
            onChange={(value) => setCategory(value)}
            groups={categorySelectGroups}
            placeholder={t('allCategories')}
            searchPlaceholder={t('searchPlaceholder')}
            className="min-w-[16rem] flex-1 sm:flex-initial"
          />
        </div>

        {(promotedLoading || promotedBusinesses.length > 0) && (
          <div className="mt-10">
            <h2 className="section-title flex items-center gap-2">
              <Crown className="h-5 w-5 text-neon-gold" /> {t('featuredBusinessesTitle')}
            </h2>
            {promotedLoading ? (
              <div className="mt-6 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="glass-card h-48 animate-pulse p-6" />
                ))}
              </div>
            ) : (
              <div className="mt-6 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                {promotedBusinesses.map((business) => (
                  <Link key={business.id} href={`/directory/${business.id}`}>
                    <div className="glass-card h-full border-neon-gold/40 p-6 ring-1 ring-neon-gold/30 transition hover:-translate-y-1 hover:shadow-neon">
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-4">
                          {business.logoUrl ? (
                            <img
                              src={business.logoUrl}
                              alt={business.businessName}
                              className="h-14 w-14 rounded-full object-cover"
                            />
                          ) : (
                            <div className="h-14 w-14 rounded-full bg-gradient-to-br from-neon-gold to-amber-500" />
                          )}
                          <div>
                            <h3 className="text-lg font-bold">{business.businessName}</h3>
                            {business.category && (
                              <p className="text-sm text-slate-500">
                                {getDirectoryCategoryLabel(business.category)}
                              </p>
                            )}
                          </div>
                        </div>
                        <span className="inline-flex items-center gap-1 rounded-full bg-neon-gold/10 px-2 py-1 text-xs font-medium text-neon-gold">
                          <Crown className="h-3 w-3" /> {t('promoted')}
                        </span>
                      </div>
                      <p className="mt-4 line-clamp-2 text-sm text-slate-600 dark:text-slate-400">
                        {business.description || t('noDescription')}
                      </p>
                      {business.address && (
                        <div className="mt-4 flex items-center gap-1 text-xs text-slate-500">
                          <MapPin className="h-3 w-3" /> {business.address}
                        </div>
                      )}
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>
        )}

        {businessesLoading ? (
          <div className="mt-10 flex justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-neon-blue" />
          </div>
        ) : (
          <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {businesses.map((business) => (
              <Link key={business.id} href={`/directory/${business.id}`}>
                <div
                  className={`glass-card h-full p-6 transition hover:-translate-y-1 hover:shadow-neon ${
                    business.isPromoted ? 'border-neon-gold/40 ring-1 ring-neon-gold/30' : ''
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-4">
                      {business.logoUrl ? (
                        <img
                          src={business.logoUrl}
                          alt={business.businessName}
                          className="h-14 w-14 rounded-full object-cover"
                        />
                      ) : (
                        <div className="h-14 w-14 rounded-full bg-gradient-to-br from-neon-gold to-amber-500" />
                      )}
                      <div>
                        <h3 className="text-lg font-bold">{business.businessName}</h3>
                        {business.category && (
                          <p className="text-sm text-slate-500">
                            {getDirectoryCategoryLabel(business.category)}
                          </p>
                        )}
                      </div>
                    </div>
                    {business.isPromoted && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-neon-gold/10 px-2 py-1 text-xs font-medium text-neon-gold">
                        <Crown className="h-3 w-3" /> {t('promoted')}
                      </span>
                    )}
                  </div>
                  <p className="mt-4 line-clamp-2 text-sm text-slate-600 dark:text-slate-400">
                    {business.description || t('noDescription')}
                  </p>
                  <div className="mt-4 flex items-center gap-4 text-xs text-slate-500">
                    {business.address && (
                      <span className="flex items-center gap-1">
                        <MapPin className="h-3 w-3" /> {business.address}
                      </span>
                    )}
                    <span className="flex items-center gap-1">
                      <Briefcase className="h-3 w-3" /> {t('jobCount', { count: business._count.jobAds })}
                    </span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}

        <div className="mt-16">
          <h2 className="section-title">{t('jobAdsTitle')}</h2>
          {jobsLoading ? (
            <div className="mt-6 flex justify-center">
              <Loader2 className="h-6 w-6 animate-spin text-neon-blue" />
            </div>
          ) : (
            <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {jobs.map((job) => (
                <Link key={job.id} href={`/directory/${job.businessListing.id}`}>
                  <div className="glass-card p-5 transition hover:-translate-y-1 hover:shadow-neon">
                    <h3 className="font-bold">{job.title}</h3>
                    <p className="text-sm text-slate-500">{job.businessListing.businessName}</p>
                    <div className="mt-3 flex flex-wrap gap-2 text-xs text-slate-500">
                      {job.location && <span>{job.location}</span>}
                      {job.salaryRange && <span>{job.salaryRange}</span>}
                      {job.closingDate && (
                        <span>{t('closes', { date: formatDate(job.closingDate) })}</span>
                      )}
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>

        {user && (
          <FeatureGate
            feature={MembershipFeature.DIRECTORY_LISTING}
            fallback={
              <div className="mt-16 rounded-xl border border-neon-gold/20 bg-neon-gold/5 p-6 text-center">
                <Lock className="mx-auto h-6 w-6 text-neon-gold" />
                <h3 className="mt-2 font-semibold">{t('membershipRequiredTitle')}</h3>
                <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
                  {t('membershipRequiredText')}
                </p>
              </div>
            }
          >
            <div className="mt-16 grid gap-8 lg:grid-cols-2">
              <div className="glass-card p-6">
              <h3 className="flex items-center gap-2 text-xl font-bold">
                <Plus className="h-5 w-5" /> {t('listBusiness.title')}
              </h3>
              <form
                onSubmit={businessForm.handleSubmit((data) => createBusiness.mutate(data))}
                className="mt-4 space-y-4"
              >
                <div>
                  <label className="text-sm font-medium">{t('listBusiness.businessName')}</label>
                  <input {...businessForm.register('businessName')} className={inputClass} />
                  {businessErrors.businessName && (
                    <p className="mt-1 text-xs text-red-500">{businessErrors.businessName.message}</p>
                  )}
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label className="text-sm font-medium">{t('listBusiness.category')}</label>
                    <Controller
                      name="category"
                      control={businessForm.control}
                      render={({ field }) => (
                        <SearchableSelect
                          value={field.value ?? ''}
                          onChange={field.onChange}
                          onBlur={field.onBlur}
                          groups={categorySelectGroups}
                          placeholder={t('allCategories')}
                          searchPlaceholder={t('searchPlaceholder')}
                          className="mt-1"
                        />
                      )}
                    />
                    {businessErrors.category && (
                      <p className="mt-1 text-xs text-red-500">{businessErrors.category.message}</p>
                    )}
                  </div>
                  <div>
                    <label className="text-sm font-medium">{t('listBusiness.website')}</label>
                    <input {...businessForm.register('websiteUrl')} className={inputClass} />
                    {businessErrors.websiteUrl && (
                      <p className="mt-1 text-xs text-red-500">{businessErrors.websiteUrl.message}</p>
                    )}
                  </div>
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label className="text-sm font-medium">{t('listBusiness.email')}</label>
                    <input {...businessForm.register('email')} className={inputClass} />
                    {businessErrors.email && (
                      <p className="mt-1 text-xs text-red-500">{businessErrors.email.message}</p>
                    )}
                  </div>
                  <div>
                    <label className="text-sm font-medium">{t('listBusiness.phone')}</label>
                    <input {...businessForm.register('phone')} className={inputClass} />
                  </div>
                </div>
                <div>
                  <label className="text-sm font-medium">{t('listBusiness.address')}</label>
                  <input {...businessForm.register('address')} className={inputClass} />
                </div>
                <div>
                  <label className="text-sm font-medium">{t('listBusiness.description')}</label>
                  <textarea
                    rows={4}
                    {...businessForm.register('description')}
                    className={`${inputClass} resize-none`}
                  />
                </div>
                <div>
                  <ImageUpload
                    label={t('listBusiness.logo')}
                    value={watchBusiness('logoUrl')}
                    onChange={(url) => setBusinessValue('logoUrl', url, { shouldValidate: true })}
                    hideUrlInput
                  />
                  {businessErrors.logoUrl && (
                    <p className="mt-1 text-xs text-red-500">{businessErrors.logoUrl.message}</p>
                  )}
                </div>
                {createBusiness.error && (
                  <p className="text-sm text-red-500">{getApiErrorMessage(createBusiness.error)}</p>
                )}
                <button
                  type="submit"
                  disabled={createBusiness.isPending}
                  className="btn-primary w-full"
                >
                  {createBusiness.isPending ? t('listBusiness.saving') : t('listBusiness.submit')}
                </button>
              </form>
            </div>

            <div className="glass-card p-6">
              <h3 className="flex items-center gap-2 text-xl font-bold">
                <Plus className="h-5 w-5" /> {t('postJob.title')}
              </h3>
              <form
                onSubmit={jobForm.handleSubmit((data) => createJob.mutate(data))}
                className="mt-4 space-y-4"
              >
                <div>
                  <label className="text-sm font-medium">{t('postJob.business')}</label>
                  <select
                    {...jobForm.register('businessListingId')}
                    className={`${inputClass} appearance-none`}
                  >
                    <option value="">{t('postJob.selectBusiness')}</option>
                    {businesses
                      .filter((b) => user?.role === 'ADMIN' || b.ownerUserId === user?.id)
                      .map((b) => (
                        <option key={b.id} value={b.id}>
                          {b.businessName}
                        </option>
                      ))}
                  </select>
                  {jobForm.formState.errors.businessListingId && (
                    <p className="mt-1 text-xs text-red-500">
                      {jobForm.formState.errors.businessListingId.message}
                    </p>
                  )}
                </div>
                <div>
                  <label className="text-sm font-medium">{t('postJob.jobTitle')}</label>
                  <input {...jobForm.register('title')} className={inputClass} />
                  {jobForm.formState.errors.title && (
                    <p className="mt-1 text-xs text-red-500">{jobForm.formState.errors.title.message}</p>
                  )}
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label className="text-sm font-medium">{t('postJob.location')}</label>
                    <input {...jobForm.register('location')} className={inputClass} />
                  </div>
                  <div>
                    <label className="text-sm font-medium">{t('postJob.salaryRange')}</label>
                    <input {...jobForm.register('salaryRange')} className={inputClass} />
                  </div>
                </div>
                <div>
                  <label className="text-sm font-medium">{t('postJob.contactEmail')}</label>
                  <input {...jobForm.register('contactEmail')} className={inputClass} />
                </div>
                <div>
                  <label className="text-sm font-medium">{t('postJob.description')}</label>
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
                  <label className="text-sm font-medium">{t('postJob.publishImmediately')}</label>
                </div>
                <button type="submit" disabled={createJob.isPending} className="btn-primary w-full">
                  {createJob.isPending ? t('postJob.saving') : t('postJob.submit')}
                </button>
              </form>
            </div>
          </div>
          </FeatureGate>
        )}
      </div>
    </div>
  );
}
