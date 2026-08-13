'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { useMutation } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { Loader2 } from 'lucide-react';
import { api } from '@/lib/api';
import { Link } from '@/i18n/routing';
import type { ContactBlock } from '@kentslsc/shared';

interface Props {
  block: ContactBlock;
}

export default function ContactBlockComponent({ block }: Props) {
  const { title, content } = block;
  const t = useTranslations('contactBlock');
  const [form, setForm] = useState({
    name: '',
    email: '',
    phone: '',
    subject: '',
    message: '',
    website: '',
    consent: false
  });
  const [sent, setSent] = useState(false);

  const mutation = useMutation({
    mutationFn: async (payload: typeof form) => {
      await api.post('/contact', payload);
    },
    onSuccess: () => {
      setSent(true);
      setForm({ name: '', email: '', phone: '', subject: '', message: '', website: '', consent: false });
    }
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.consent) return;
    mutation.mutate(form);
  };

  return (
    <section className="px-4 py-16 md:px-6">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        className="mx-auto max-w-3xl"
      >
        {title && <h2 className="section-title text-center">{title}</h2>}
        {content && <p className="mt-4 text-center text-slate-700 dark:text-slate-400">{content}</p>}

        {sent ? (
          <div className="mt-8 rounded-2xl bg-green-500/10 p-6 text-center text-green-700 dark:text-green-400">
            {t('successMessage')}
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="mt-8 space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <input
                required
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder={t('namePlaceholder')}
                className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm outline-none focus:border-neon-blue dark:border-white/10 dark:bg-white/5"
              />
              <input
                required
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                placeholder={t('emailPlaceholder')}
                className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm outline-none focus:border-neon-blue dark:border-white/10 dark:bg-white/5"
              />
            </div>
            <input
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
              placeholder={t('phonePlaceholder')}
              className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm outline-none focus:border-neon-blue dark:border-white/10 dark:bg-white/5"
            />
            <input
              required
              value={form.subject}
              onChange={(e) => setForm({ ...form, subject: e.target.value })}
              placeholder={t('subjectPlaceholder')}
              className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm outline-none focus:border-neon-blue dark:border-white/10 dark:bg-white/5"
            />
            <textarea
              required
              value={form.message}
              onChange={(e) => setForm({ ...form, message: e.target.value })}
              placeholder={t('messagePlaceholder')}
              rows={5}
              className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm outline-none focus:border-neon-blue dark:border-white/10 dark:bg-white/5"
            />

            {/* Honeypot: hidden from real users, bots usually fill it. */}
            <div className="sr-only" aria-hidden="true">
              <label htmlFor="website">Website</label>
              <input
                id="website"
                tabIndex={-1}
                autoComplete="off"
                value={form.website}
                onChange={(e) => setForm({ ...form, website: e.target.value })}
                className="h-0 w-0"
              />
            </div>

            <div className="flex items-start gap-3">
              <input
                id="consent"
                type="checkbox"
                required
                checked={form.consent}
                onChange={(e) => setForm({ ...form, consent: e.target.checked })}
                className="mt-1 h-4 w-4 rounded border-slate-300 text-neon-blue focus:ring-neon-blue dark:border-white/10"
              />
              <label htmlFor="consent" className="text-sm text-slate-700 dark:text-slate-300">
                {t('privacyConsentLabel')}{' '}
                <Link href="/privacy" className="text-neon-blue hover:underline">
                  {t('privacyLinkText')}
                </Link>
              </label>
            </div>

            <button
              type="submit"
              disabled={!form.consent || mutation.isPending}
              className="btn-primary w-full disabled:opacity-60"
            >
              {mutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              {t('sendMessage')}
            </button>
          </form>
        )}
      </motion.div>
    </section>
  );
}
