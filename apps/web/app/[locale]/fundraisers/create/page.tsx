'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Loader2, Send, CheckCircle2 } from 'lucide-react';
import { ImageUpload } from '@/components/ui/ImageUpload';
import { api } from '@/lib/api';
import { useAuth } from '@/hooks/useAuth';
import { Link } from '@/i18n/routing';

const CATEGORIES = [
  { value: 'CHARITY', label: 'Charity' },
  { value: 'SPORTS', label: 'Sports' },
  { value: 'COMMUNITY', label: 'Community' },
  { value: 'MEMORIAL', label: 'Memorial' },
  { value: 'MEDICAL', label: 'Medical' },
  { value: 'OTHER', label: 'Other' }
];

const schema = z.object({
  title: z.string().min(3, 'Title must be at least 3 characters'),
  description: z.string().min(20, 'Please write at least 20 characters describing your campaign'),
  targetAmount: z.coerce.number().min(1, 'Target must be at least £1'),
  category: z.string().min(1, 'Please select a category'),
  startDate: z.string().min(1, 'Start date is required'),
  endDate: z.string().min(1, 'End date is required'),
  imageUrl: z.string().optional(),
  imagePath: z.string().optional()
});

type FormValues = z.infer<typeof schema>;

export default function CreateFundraiserPage() {
  const { user, loading: authLoading } = useAuth();
  const t = useTranslations('fundraisers');
  const [submitted, setSubmitted] = useState(false);
  const [submitError, setSubmitError] = useState('');

  const today = new Date().toISOString().slice(0, 10);
  const defaultEnd = new Date(Date.now() + 30 * 86_400_000).toISOString().slice(0, 10);

  const { register, handleSubmit, setValue, watch, formState: { errors, isSubmitting } } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { category: 'CHARITY', startDate: today, endDate: defaultEnd }
  });

  if (authLoading) {
    return <div className="flex min-h-screen items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-neon-blue" /></div>;
  }

  if (!user) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 px-4">
        <p className="text-lg text-slate-600 dark:text-slate-400">Please log in to start a fundraising campaign.</p>
        <Link href="/auth/login" className="btn-primary">Log in</Link>
      </div>
    );
  }

  if (submitted) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 px-4 text-center">
        <CheckCircle2 className="h-16 w-16 text-green-500" />
        <h1 className="text-2xl font-bold">{t('create.successTitle')}</h1>
        <p className="max-w-md text-slate-600 dark:text-slate-400">{t('create.successMessage')}</p>
        <Link href="/fundraisers/my-campaigns" className="btn-primary">{t('myCampaigns')}</Link>
      </div>
    );
  }

  const onSubmit = async (values: FormValues) => {
    setSubmitError('');
    try {
      await api.post('/fundraisers', {
        ...values,
        imageUrl: values.imageUrl || undefined,
        imagePath: values.imagePath || undefined,
        isActive: true
      });
      setSubmitted(true);
    } catch {
      setSubmitError('Failed to submit your campaign. Please try again.');
    }
  };

  return (
    <div className="px-4 py-16 md:px-6">
      <div className="mx-auto max-w-2xl">
        <h1 className="section-title">{t('create.title')}</h1>
        <p className="mt-2 text-slate-600 dark:text-slate-400">{t('create.subtitle')}</p>

        <div className="mt-8 glass-card p-8">
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
            {/* Campaign image */}
            <div>
              <label className="mb-2 block text-sm font-semibold text-slate-700 dark:text-slate-300">
                Campaign image
              </label>
              <ImageUpload
                label=""
                value={watch('imageUrl')}
                onChange={(url, path) => {
                  setValue('imageUrl', url, { shouldValidate: true });
                  if (path) setValue('imagePath', path, { shouldValidate: true });
                }}
                hideUrlInput
                showPreview
                previewClassName="h-48 w-full rounded-xl object-cover"
              />
            </div>

            {/* Title */}
            <div>
              <label className="mb-1 block text-sm font-semibold text-slate-700 dark:text-slate-300">
                Campaign title <span className="text-red-400">*</span>
              </label>
              <input
                {...register('title')}
                placeholder="e.g. Help us raise funds for UNICEF Ireland"
                className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm outline-none focus:border-neon-blue dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
              />
              {errors.title && <p className="mt-1 text-xs text-red-400">{errors.title.message}</p>}
            </div>

            {/* Description */}
            <div>
              <label className="mb-1 block text-sm font-semibold text-slate-700 dark:text-slate-300">
                Your story <span className="text-red-400">*</span>
              </label>
              <textarea
                {...register('description')}
                rows={6}
                placeholder="Tell donors why you're raising money and what it will be used for..."
                className="w-full resize-none rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm outline-none focus:border-neon-blue dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
              />
              {errors.description && <p className="mt-1 text-xs text-red-400">{errors.description.message}</p>}
            </div>

            {/* Category + Target */}
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-sm font-semibold text-slate-700 dark:text-slate-300">
                  Category <span className="text-red-400">*</span>
                </label>
                <select
                  {...register('category')}
                  className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm outline-none focus:border-neon-blue dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
                >
                  {CATEGORIES.map((c) => (
                    <option key={c.value} value={c.value}>{c.label}</option>
                  ))}
                </select>
                {errors.category && <p className="mt-1 text-xs text-red-400">{errors.category.message}</p>}
              </div>
              <div>
                <label className="mb-1 block text-sm font-semibold text-slate-700 dark:text-slate-300">
                  Fundraising target (£) <span className="text-red-400">*</span>
                </label>
                <input
                  type="number"
                  step="1"
                  min="1"
                  {...register('targetAmount')}
                  className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm outline-none focus:border-neon-blue dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
                />
                {errors.targetAmount && <p className="mt-1 text-xs text-red-400">{errors.targetAmount.message}</p>}
              </div>
            </div>

            {/* Dates */}
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-sm font-semibold text-slate-700 dark:text-slate-300">Start date</label>
                <input
                  type="date"
                  {...register('startDate')}
                  className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm outline-none focus:border-neon-blue dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-semibold text-slate-700 dark:text-slate-300">End date</label>
                <input
                  type="date"
                  {...register('endDate')}
                  className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm outline-none focus:border-neon-blue dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
                />
              </div>
            </div>

            {submitError && <p className="rounded-xl bg-red-50 p-3 text-sm text-red-600 dark:bg-red-900/30">{submitError}</p>}

            <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-900/20 dark:text-amber-300">
              Your campaign will be reviewed by our team before going live. You&apos;ll be notified once it&apos;s approved.
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="btn-primary flex w-full items-center justify-center gap-2 py-3 text-base"
            >
              {isSubmitting ? <Loader2 className="h-5 w-5 animate-spin" /> : <Send className="h-5 w-5" />}
              {isSubmitting ? 'Submitting…' : t('create.submit')}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
