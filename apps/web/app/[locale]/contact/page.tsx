'use client';

import { Suspense, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation } from '@tanstack/react-query';
import { Mail, Phone, MapPin, Send, CheckCircle, Loader2, MessageSquare } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTranslations } from 'next-intl';
import { useSearchParams } from 'next/navigation';
import { contactMessageSchema, type ContactMessageInput } from '@kentslsc/shared';
import { api } from '@/lib/api';

interface ContactResponse {
  id: string;
  aiFaqResponse?: string | null;
}

const contactDetails = [
  { id: 'email', icon: Mail, value: 'info@kentslsc.org', href: 'mailto:info@kentslsc.org' },
  { id: 'phone', icon: Phone, value: '+44 1234 567890', href: 'tel:+441234567890' },
  {
    id: 'address',
    icon: MapPin,
    value: 'Kent Sri Lankan Social Club, Community Centre, Maidstone, Kent ME15 9JQ',
    href: '#'
  }
] as const;

function ContactPageContent() {
  const t = useTranslations('contact');
  const auth = useTranslations('auth');
  const searchParams = useSearchParams();
  const [aiResponse, setAiResponse] = useState<string | null>(null);

  const defaultSubject = searchParams?.get('subject') ?? '';
  const defaultMessage = searchParams?.get('message') ?? '';

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors }
  } = useForm<ContactMessageInput>({
    resolver: zodResolver(contactMessageSchema),
    defaultValues: {
      name: '',
      email: '',
      phone: '',
      subject: defaultSubject,
      message: defaultMessage
    }
  });

  const mutation = useMutation<ContactResponse, Error, ContactMessageInput>({
    mutationFn: async (data) => {
      const { data: response } = await api.post<ContactResponse>('/contact', data);
      return response;
    },
    onSuccess: (response) => {
      if (response.aiFaqResponse) {
        setAiResponse(response.aiFaqResponse);
      }
      reset();
    }
  });

  const onSubmit = (data: ContactMessageInput) => {
    setAiResponse(null);
    mutation.mutate(data);
  };

  return (
    <div className="relative overflow-hidden px-4 py-16 md:px-6">
      <div className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
        <div className="absolute -left-20 top-20 h-72 w-72 rounded-full bg-neon-blue/20 blur-3xl" />
        <div className="absolute bottom-20 right-0 h-96 w-96 rounded-full bg-neon-gold/20 blur-3xl" />
      </div>

      <div className="mx-auto max-w-6xl">
        <div className="text-center">
          <h1 className="section-title">{t('title')}</h1>
          <p className="mx-auto mt-4 max-w-2xl text-slate-600 dark:text-slate-400">
            {t('subtitle')}
          </p>
        </div>

        <div className="mt-12 grid gap-8 lg:grid-cols-5">
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            className="lg:col-span-2 space-y-6"
          >
            <div className="glass-card p-6">
              <h2 className="text-xl font-bold">{t('clubDetailsTitle')}</h2>
              <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
                {t('clubDetailsText')}
              </p>
              <div className="mt-6 space-y-4">
                {contactDetails.map((detail) => (
                  <a
                    key={detail.id}
                    href={detail.href}
                    className="flex items-start gap-4 rounded-xl bg-white/5 p-4 transition-colors hover:bg-white/10"
                  >
                    <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-neon-blue/10 text-neon-blue">
                      <detail.icon className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                        {t(`labels.${detail.id}`)}
                      </p>
                      <p className="mt-0.5 text-sm font-medium">{detail.value}</p>
                    </div>
                  </a>
                ))}
              </div>
            </div>

            <div className="glass-card p-6">
              <h2 className="text-xl font-bold">{t('responseTimesTitle')}</h2>
              <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
                {t('responseTimesText')}
              </p>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.1 }}
            className="lg:col-span-3"
          >
            <div className="glass-card p-6 md:p-8">
              <AnimatePresence mode="wait">
                {mutation.isSuccess ? (
                  <motion.div
                    key="success"
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    className="text-center"
                  >
                    <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-green-500/10 text-green-500">
                      <CheckCircle className="h-8 w-8" />
                    </div>
                    <h2 className="mt-4 text-2xl font-bold">{t('successTitle')}</h2>
                    <p className="mt-2 text-slate-600 dark:text-slate-400">{t('successText')}</p>
                    {aiResponse && (
                      <div className="mt-6 rounded-xl border border-neon-gold/20 bg-neon-gold/5 p-4 text-left">
                        <div className="flex items-center gap-2 text-neon-gold">
                          <MessageSquare className="h-4 w-4" />
                          <span className="text-sm font-semibold">{t('suggestedAnswer')}</span>
                        </div>
                        <p className="mt-2 text-sm text-slate-700 dark:text-slate-300">{aiResponse}</p>
                      </div>
                    )}
                    <button onClick={() => mutation.reset()} className="btn-primary mt-8">
                      {t('sendAnother')}
                    </button>
                  </motion.div>
                ) : (
                  <motion.form
                    key="form"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    onSubmit={handleSubmit(onSubmit)}
                    className="space-y-5"
                  >
                    <div className="grid gap-5 sm:grid-cols-2">
                      <div>
                        <label htmlFor="name" className="mb-1 block text-sm font-medium">
                          {auth('name')}
                        </label>
                        <input
                          id="name"
                          {...register('name')}
                          placeholder={t('placeholders.name')}
                          className="w-full rounded-lg border border-white/10 bg-white/10 px-4 py-3 outline-none transition-colors focus:border-neon-blue focus:bg-white/20"
                        />
                        {errors.name && (
                          <p className="mt-1 text-xs text-rose-500">{errors.name.message}</p>
                        )}
                      </div>
                      <div>
                        <label htmlFor="email" className="mb-1 block text-sm font-medium">
                          {auth('email')}
                        </label>
                        <input
                          id="email"
                          type="email"
                          {...register('email')}
                          placeholder={t('placeholders.email')}
                          className="w-full rounded-lg border border-white/10 bg-white/10 px-4 py-3 outline-none transition-colors focus:border-neon-blue focus:bg-white/20"
                        />
                        {errors.email && (
                          <p className="mt-1 text-xs text-rose-500">{errors.email.message}</p>
                        )}
                      </div>
                    </div>

                    <div>
                      <label htmlFor="phone" className="mb-1 block text-sm font-medium">
                        {auth('phone')} <span className="text-slate-500">({auth('optional')})</span>
                      </label>
                      <input
                        id="phone"
                        {...register('phone')}
                        placeholder={t('placeholders.phone')}
                        className="w-full rounded-lg border border-white/10 bg-white/10 px-4 py-3 outline-none transition-colors focus:border-neon-blue focus:bg-white/20"
                      />
                    </div>

                    <div>
                      <label htmlFor="subject" className="mb-1 block text-sm font-medium">
                        {auth('subject')}
                      </label>
                      <input
                        id="subject"
                        {...register('subject')}
                        placeholder={t('placeholders.subject')}
                        className="w-full rounded-lg border border-white/10 bg-white/10 px-4 py-3 outline-none transition-colors focus:border-neon-blue focus:bg-white/20"
                      />
                      {errors.subject && (
                        <p className="mt-1 text-xs text-rose-500">{errors.subject.message}</p>
                      )}
                    </div>

                    <div>
                      <label htmlFor="message" className="mb-1 block text-sm font-medium">
                        {auth('message')}
                      </label>
                      <textarea
                        id="message"
                        rows={5}
                        {...register('message')}
                        placeholder={t('placeholders.message')}
                        className="w-full rounded-lg border border-white/10 bg-white/10 px-4 py-3 outline-none transition-colors focus:border-neon-blue focus:bg-white/20"
                      />
                      {errors.message && (
                        <p className="mt-1 text-xs text-rose-500">{errors.message.message}</p>
                      )}
                    </div>

                    {mutation.isError && (
                      <p className="text-sm text-rose-500">{t('formError')}</p>
                    )}

                    <button
                      type="submit"
                      disabled={mutation.isPending}
                      className="btn-primary flex w-full items-center justify-center gap-2 disabled:opacity-70"
                    >
                      {mutation.isPending ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin" /> {t('sending')}
                        </>
                      ) : (
                        <>
                          <Send className="h-4 w-4" /> {t('sendMessage')}
                        </>
                      )}
                    </button>
                  </motion.form>
                )}
              </AnimatePresence>
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  );
}

export default function ContactPage() {
  return (
    <Suspense fallback={<div className="min-h-screen" />}>
      <ContactPageContent />
    </Suspense>
  );
}
