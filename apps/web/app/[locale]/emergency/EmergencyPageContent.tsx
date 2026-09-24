'use client';

import { motion } from 'framer-motion';
import {
  Siren,
  Shield,
  Phone,
  Stethoscope,
  Zap,
  HeartPulse,
  Handshake,
  MessageCircle,
  Brain,
  ShieldAlert,
  Baby,
  Smile,
  HeartHandshake
} from 'lucide-react';
import { useTranslations } from 'next-intl';

interface SectionTheme {
  iconBg: string;
  numberText: string;
  chip: string;
}

interface ContactItem {
  id: string;
  icon: React.ElementType;
  number: string;
  tel?: string;
  text?: boolean;
}

interface Section {
  id: string;
  icon: React.ElementType;
  theme: SectionTheme;
  contacts: ContactItem[];
}

const sections: Section[] = [
  {
    id: 'ukServices',
    icon: Siren,
    theme: {
      iconBg: 'bg-red-500/10 text-red-500',
      numberText: 'text-red-600 dark:text-red-400',
      chip: 'border-red-500/30 bg-red-500/10 text-red-700 dark:text-red-400'
    },
    contacts: [
      { id: 'uk999', icon: Siren, number: '999', tel: '999' },
      { id: 'uk101', icon: Shield, number: '101', tel: '101' },
      { id: 'uk111', icon: Stethoscope, number: '111', tel: '111' },
      { id: 'uk112', icon: Phone, number: '112', tel: '112' },
      { id: 'uk105', icon: Zap, number: '105', tel: '105' }
    ]
  },
  {
    id: 'ukMentalHealth',
    icon: HeartPulse,
    theme: {
      iconBg: 'bg-purple-500/10 text-purple-500',
      numberText: 'text-purple-600 dark:text-purple-400',
      chip: 'border-purple-500/30 bg-purple-500/10 text-purple-700 dark:text-purple-400'
    },
    contacts: [
      { id: 'samaritans', icon: Handshake, number: '116 123', tel: '116123' },
      { id: 'shout', icon: MessageCircle, number: '85258', text: true },
      { id: 'saneline', icon: Brain, number: '0300 304 7000', tel: '03003047000' },
      { id: 'nhsMentalHealth', icon: HeartPulse, number: '111', tel: '111' }
    ]
  },
  {
    id: 'ukSupport',
    icon: HeartHandshake,
    theme: {
      iconBg: 'bg-teal-500/10 text-teal-500',
      numberText: 'text-teal-600 dark:text-teal-400',
      chip: 'border-teal-500/30 bg-teal-500/10 text-teal-700 dark:text-teal-400'
    },
    contacts: [
      { id: 'domesticAbuse', icon: ShieldAlert, number: '0808 2000 247', tel: '08082000247' },
      { id: 'nspcc', icon: Baby, number: '0808 800 5000', tel: '08088005000' },
      { id: 'childline', icon: Smile, number: '0800 1111', tel: '08001111' },
      { id: 'silverLine', icon: HeartHandshake, number: '0800 4 70 80 90', tel: '08004708090' }
    ]
  }
];

const container = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.06 }
  }
};

const fadeUp = {
  hidden: { opacity: 0, y: 24 },
  show: { opacity: 1, y: 0 }
};

export default function EmergencyPageContent() {
  const t = useTranslations('emergency');

  return (
    <div className="relative overflow-hidden px-4 py-16 md:px-6">
      <div className="pointer-events-none absolute inset-0 -z-10 overflow-hidden opacity-40">
        <div className="absolute -right-20 top-0 h-96 w-96 rounded-full bg-red-500/10 blur-3xl" />
        <div className="absolute bottom-40 -left-20 h-80 w-80 rounded-full bg-teal-500/10 blur-3xl" />
        <div className="absolute left-1/2 top-1/3 h-64 w-64 -translate-x-1/2 rounded-full bg-purple-500/10 blur-3xl" />
      </div>

      <div className="mx-auto max-w-5xl">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center"
        >
          <h1 className="section-title">{t('title')}</h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg text-slate-600 dark:text-slate-300">
            {t('subtitle')}
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="mt-10 rounded-2xl border border-red-500/40 bg-red-500/10 p-6 text-center shadow-lg"
        >
          <p className="text-xl font-bold text-red-700 dark:text-red-400">{t('bannerTitle')}</p>
          <p className="mt-1 text-slate-700 dark:text-slate-300">{t('bannerText')}</p>
        </motion.div>

        {sections.map((section) => (
          <div key={section.id} className="mt-16">
            <div className="text-center">
              <div
                className={`mx-auto flex h-14 w-14 items-center justify-center rounded-full ${section.theme.iconBg}`}
              >
                <section.icon className="h-7 w-7" />
              </div>
              <h2 className="mt-4 text-2xl font-bold md:text-3xl">{t(`sections.${section.id}.title`)}</h2>
              <p className="mx-auto mt-3 max-w-2xl text-slate-600 dark:text-slate-400">
                {t(`sections.${section.id}.subtitle`)}
              </p>
            </div>

            <motion.div
              variants={container}
              initial="hidden"
              whileInView="show"
              viewport={{ once: true }}
              className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3"
            >
              {section.contacts.map((contact) => (
                <motion.div key={contact.id} variants={fadeUp}>
                  <div className="glass-card flex h-full flex-col p-5">
                    <div className="flex items-center gap-3">
                      <div
                        className={`flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl ${section.theme.iconBg}`}
                      >
                        <contact.icon className="h-5 w-5" />
                      </div>
                      <h3 className="font-semibold leading-snug">{t(`contacts.${contact.id}.name`)}</h3>
                    </div>
                    <p className="mt-3 flex-1 text-sm text-slate-600 dark:text-slate-400">
                      {t(`contacts.${contact.id}.description`)}
                    </p>
                    <div className="mt-4">
                      {contact.text ? (
                        <span
                          className={`inline-block rounded-xl border px-4 py-2 text-2xl font-bold tracking-wide ${section.theme.chip}`}
                        >
                          {contact.number}
                        </span>
                      ) : (
                        <a
                          href={`tel:${contact.tel}`}
                          className={`inline-block text-3xl font-bold tracking-wide transition-transform hover:scale-105 ${section.theme.numberText}`}
                        >
                          {contact.number}
                        </a>
                      )}
                    </div>
                  </div>
                </motion.div>
              ))}
            </motion.div>
          </div>
        ))}

        <p className="mx-auto mt-16 max-w-2xl text-center text-sm text-slate-500 dark:text-slate-400">
          {t('disclaimer')}
        </p>
      </div>
    </div>
  );
}
