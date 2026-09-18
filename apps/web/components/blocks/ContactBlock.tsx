'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { useMutation } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Loader2 } from 'lucide-react';
import { api, getApiErrorMessage } from '@/lib/api';
import { Link } from '@/i18n/routing';
import { FadeIn } from '@/components/ui/FadeIn';
import { contactMessageSchema, type ContactMessageInput } from '@kentslsc/shared';
import type { ContactBlock } from '@kentslsc/shared';

interface Props {
  block: ContactBlock;
}

export default function ContactBlockComponent({ block }: Props) {
  const { title, content } = block;
  const t = useTranslations('contactBlock');
  const [sent, setSent] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    watch,
    formState: { errors }
  } = useForm<ContactMessageInput>({
    resolver: zodResolver(contactMessageSchema),
    defaultValues: {
      name: '',
      email: '',
      phone: '',
      subject: '',
      message: '',
      website: '',
      consent: false
    }
  });

  const consent = watch('consent');

  const mutation = useMutation({
    mutationFn: async (payload: ContactMessageInput) => {
      await api.post('/contact', payload);
    },
    onSuccess: () => {
      setSent(true);
      setSubmitError(null);
      reset();
    },
    onError: (err: unknown) => {
      setSubmitError(getApiErrorMessage(err) ?? 'Something went wrong. Please try again.');
    }
  });

  const onSubmit = (data: ContactMessageInput) => {
    setSubmitError(null);
    mutation.mutate(data);
  };

  return (
    <section className="px-4 py-16 md:px-6">
      <FadeIn className="mx-auto max-w-3xl">
        {title && <h2 className="section-title text-center">{title}</h2>}
        {content && <p className="mt-4 text-center text-slate-700 dark:text-slate-400">{content}</p>}

        {sent ? (
          <div className="mt-8 rounded-2xl bg-green-500/10 p-6 text-center text-green-700 dark:text-green-400">
            {t('successMessage')}
          </div>
        ) : (
          <form onSubmit={handleSubmit(onSubmit)} className="mt-8 space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <input
                  {...register('name')}
                  placeholder={t('namePlaceholder')}
                  className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm outline-none focus:border-neon-blue dark:border-white/10 dark:bg-white/5"
                />
                {errors.name && <p className="mt-1 text-xs text-rose-500">{errors.name.message}</p>}
              </div>
              <div>
                <input
                  type="email"
                  {...register('email')}
                  placeholder={t('emailPlaceholder')}
                  className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm outline-none focus:border-neon-blue dark:border-white/10 dark:bg-white/5"
                />
                {errors.email && <p className="mt-1 text-xs text-rose-500">{errors.email.message}</p>}
              </div>
            </div>
            <div>
              <input
                {...register('phone')}
                placeholder={t('phonePlaceholder')}
                className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm outline-none focus:border-neon-blue dark:border-white/10 dark:bg-white/5"
              />
              {errors.phone && <p className="mt-1 text-xs text-rose-500">{errors.phone.message}</p>}
            </div>
            <div>
              <input
                {...register('subject')}
                placeholder={t('subjectPlaceholder')}
                className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm outline-none focus:border-neon-blue dark:border-white/10 dark:bg-white/5"
              />
              {errors.subject && <p className="mt-1 text-xs text-rose-500">{errors.subject.message}</p>}
            </div>
            <div>
              <textarea
                {...register('message')}
                placeholder={t('messagePlaceholder')}
                rows={5}
                className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm outline-none focus:border-neon-blue dark:border-white/10 dark:bg-white/5"
              />
              {errors.message && <p className="mt-1 text-xs text-rose-500">{errors.message.message}</p>}
            </div>

            {/* Honeypot: hidden from real users, bots usually fill it. */}
            <div className="sr-only" aria-hidden="true">
              <label htmlFor="website">Website</label>
              <input
                id="website"
                tabIndex={-1}
                autoComplete="off"
                {...register('website')}
                className="h-0 w-0"
              />
            </div>

            <div className="flex items-start gap-3">
              <input
                id="consent"
                type="checkbox"
                {...register('consent')}
                className="mt-1 h-4 w-4 rounded border-slate-300 text-neon-blue focus:ring-neon-blue dark:border-white/10"
              />
              <label htmlFor="consent" className="text-sm text-slate-700 dark:text-slate-300">
                {t('privacyConsentLabel')}{' '}
                <Link href="/privacy" className="text-neon-blue hover:underline">
                  {t('privacyLinkText')}
                </Link>
              </label>
            </div>
            {errors.consent && <p className="text-xs text-rose-500">{errors.consent.message}</p>}

            {submitError && (
              <div className="rounded-xl bg-rose-500/10 p-3 text-sm text-rose-600 dark:text-rose-400">
                {submitError}
              </div>
            )}

            <button
              type="submit"
              disabled={!consent || mutation.isPending}
              className="btn-primary w-full disabled:opacity-60"
            >
              {mutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              {t('sendMessage')}
            </button>
          </form>
        )}
      </FadeIn>
    </section>
  );
}
