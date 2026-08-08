'use client';

import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { Loader2 } from 'lucide-react';
import { api } from '@/lib/api';
import type { ContactBlock } from '@kentslsc/shared';

interface Props {
  block: ContactBlock;
}

export default function ContactBlockComponent({ block }: Props) {
  const { title, content } = block;
  const [form, setForm] = useState({ name: '', email: '', phone: '', subject: '', message: '' });
  const [sent, setSent] = useState(false);

  const mutation = useMutation({
    mutationFn: async (payload: typeof form) => {
      await api.post('/contact', payload);
    },
    onSuccess: () => {
      setSent(true);
      setForm({ name: '', email: '', phone: '', subject: '', message: '' });
    }
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
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
            Thank you for your message. We will get back to you soon.
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="mt-8 space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <input
                required
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="Your name"
                className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm outline-none focus:border-neon-blue dark:border-white/10 dark:bg-white/5"
              />
              <input
                required
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                placeholder="Your email"
                className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm outline-none focus:border-neon-blue dark:border-white/10 dark:bg-white/5"
              />
            </div>
            <input
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
              placeholder="Phone (optional)"
              className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm outline-none focus:border-neon-blue dark:border-white/10 dark:bg-white/5"
            />
            <input
              required
              value={form.subject}
              onChange={(e) => setForm({ ...form, subject: e.target.value })}
              placeholder="Subject"
              className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm outline-none focus:border-neon-blue dark:border-white/10 dark:bg-white/5"
            />
            <textarea
              required
              value={form.message}
              onChange={(e) => setForm({ ...form, message: e.target.value })}
              placeholder="Your message"
              rows={5}
              className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm outline-none focus:border-neon-blue dark:border-white/10 dark:bg-white/5"
            />
            <button
              type="submit"
              disabled={mutation.isPending}
              className="btn-primary w-full disabled:opacity-60"
            >
              {mutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Send message
            </button>
          </form>
        )}
      </motion.div>
    </section>
  );
}
