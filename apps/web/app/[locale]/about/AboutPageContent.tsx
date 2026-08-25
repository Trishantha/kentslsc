'use client';

import { motion } from 'framer-motion';
import { Users, Heart, Globe, MapPin } from 'lucide-react';
import { useTranslations } from 'next-intl';

export interface CommitteeMember {
  id: string;
  name: string;
  position: string;
  roleKey: string;
  photoUrl?: string | null;
  displayOrder: number;
}

const valueItems = [
  { id: 'heritage', icon: Globe },
  { id: 'culture', icon: Heart },
  { id: 'unity', icon: Users }
] as const;

const milestoneItems = [
  { id: 'beginning' },
  { id: 'formed' },
  { id: 'digital' },
  { id: 'ahead' }
] as const;

const container = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.12 }
  }
};

const fadeUp = {
  hidden: { opacity: 0, y: 24 },
  show: { opacity: 1, y: 0 }
};

interface AboutPageContentProps {
  committeeItems: CommitteeMember[];
}

export default function AboutPageContent({ committeeItems }: AboutPageContentProps) {
  const t = useTranslations('about');

  return (
    <div className="relative overflow-hidden px-4 py-16 md:px-6">
      {/* Background cultural motifs */}
      <div className="pointer-events-none absolute inset-0 -z-10 overflow-hidden opacity-40">
        <div className="absolute -right-20 top-0 h-96 w-96 rounded-full bg-orange-500/10 blur-3xl" />
        <div className="absolute bottom-40 -left-20 h-80 w-80 rounded-full bg-green-700/10 blur-3xl" />
        <div className="absolute left-1/2 top-1/3 h-64 w-64 -translate-x-1/2 rounded-full bg-yellow-400/10 blur-3xl" />
      </div>

      <div className="mx-auto max-w-5xl">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center"
        >
          <div className="mx-auto mb-6 flex h-24 w-24 items-center justify-center rounded-full bg-gradient-to-br from-orange-500 via-yellow-400 to-green-700 shadow-gold">
            {/* Lion placeholder silhouette */}
            <svg viewBox="0 0 64 64" className="h-14 w-14 text-white/90" fill="currentColor">
              <path d="M32 6c-4 0-7 2-9 5-2-1-4-1-6 1-2 2-2 5-1 7-2 2-3 5-2 8 1 4 5 6 9 7 1 3 3 5 6 6 2 1 5 0 7-1 3 2 7 2 10 0 2-1 4-4 4-7 3-1 6-4 6-8 0-3-2-6-5-7 1-2 0-5-2-7-2-2-5-2-7-1-2-3-5-5-9-5zm-2 10c2 0 4 2 4 4s-2 4-4 4-4-2-4-4 2-4 4-4zm8 6c1 0 2 1 2 2s-1 2-2 2-2-1-2-2 1-2 2-2zM26 38c-3 0-5 2-5 5s2 5 5 5 5-2 5-5-2-5-5-5zm12 0c-3 0-5 2-5 5s2 5 5 5 5-2 5-5-2-5-5-5z" />
            </svg>
          </div>
          <div className="mb-6 space-y-1">
            <p className="text-2xl font-medium text-neon-gold">ආයුබෝවන් 🙏</p>
            <p className="text-2xl font-medium text-neon-gold">வணக்கம் 🙏</p>
            <p className="text-xl font-medium text-slate-500 dark:text-slate-400">Āyubōwan 🙏</p>
          </div>
          <h1 className="section-title">{t('title')}</h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg text-slate-600 dark:text-slate-300">
            {t('subtitle')}
          </p>
        </motion.div>

        <div className="mt-16 text-center">
          <h2 className="section-title">{t('valuesTitle')}</h2>
          <p className="mx-auto mt-4 max-w-2xl text-slate-600 dark:text-slate-400">
            {t('valuesSubtitle')}
          </p>
        </div>

        <motion.div
          variants={container}
          initial="hidden"
          whileInView="show"
          viewport={{ once: true }}
          className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3"
        >
          {valueItems.map((v) => (
            <motion.div key={v.id} variants={fadeUp}>
              <div className="glass-card h-full p-6 text-center">
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-neon-gold/10 text-neon-gold">
                  <v.icon className="h-6 w-6" />
                </div>
                <h3 className="mt-4 text-lg font-bold">{t(`values.${v.id}.title`)}</h3>
                <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
                  {t(`values.${v.id}.description`)}
                </p>
              </div>
            </motion.div>
          ))}
        </motion.div>

        <div className="mt-20 grid gap-6 md:grid-cols-2">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="glass-card p-8 md:p-10"
          >
            <h2 className="text-2xl font-bold gradient-text">{t('visionTitle')}</h2>
            <p className="mt-4 text-lg text-slate-600 dark:text-slate-400">{t('visionText')}</p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="glass-card p-8 md:p-10"
          >
            <h2 className="text-2xl font-bold gradient-text">{t('missionTitle')}</h2>
            <p className="mt-4 text-lg text-slate-600 dark:text-slate-400">{t('missionText')}</p>
          </motion.div>
        </div>

        <div className="mt-20">
          <h2 className="section-title text-center">{t('journeyTitle')}</h2>
          <div className="relative mt-12">
            <div className="absolute inset-0 flex justify-center md:left-1/2 md:-translate-x-1/2">
              <div className="h-full w-0.5 bg-gradient-to-b from-neon-gold via-neon-blue to-green-700/50" />
            </div>
            <motion.div
              variants={container}
              initial="hidden"
              whileInView="show"
              viewport={{ once: true }}
              className="relative space-y-12"
            >
              {milestoneItems.map((m, index) => (
                <motion.div
                  key={m.id}
                  variants={fadeUp}
                  className={`relative flex flex-col gap-4 md:flex-row md:items-center ${
                    index % 2 === 0 ? 'md:flex-row-reverse' : ''
                  }`}
                >
                  <div className="flex-1 md:text-right">
                    <div className="glass-card inline-block p-6">
                      <span className="text-sm font-bold text-neon-gold">
                        {t(`milestones.${m.id}.year`)}
                      </span>
                      <h3 className="mt-1 text-xl font-bold">{t(`milestones.${m.id}.title`)}</h3>
                      <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
                        {t(`milestones.${m.id}.description`)}
                      </p>
                    </div>
                  </div>
                  <div className="z-10 mx-auto flex h-10 w-10 items-center justify-center rounded-full border-4 border-slate-50 bg-gradient-to-br from-neon-gold to-orange-500 shadow-gold dark:border-slate-950">
                    <MapPin className="h-4 w-4 text-white" />
                  </div>
                  <div className="flex-1" />
                </motion.div>
              ))}
            </motion.div>
          </div>
        </div>

        <div className="mt-20">
          <h2 className="section-title text-center">{t('committeeTitle')}</h2>
          <p className="mx-auto mt-4 max-w-xl text-center text-slate-600 dark:text-slate-400">
            {t('committeeSubtitle')}
          </p>
          <motion.div
            variants={container}
            initial="hidden"
            whileInView="show"
            viewport={{ once: true }}
            className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3"
          >
            {committeeItems.map((member) => (
              <motion.div key={member.roleKey} variants={fadeUp}>
                <div className="glass-card p-8 text-center transition-transform hover:-translate-y-1 md:p-10">
                  <div className="mx-auto flex h-36 w-36 items-center justify-center overflow-hidden rounded-full bg-gradient-to-br from-slate-200 to-slate-300 text-4xl font-bold text-slate-500 ring-4 ring-white shadow-xl dark:from-slate-700 dark:to-slate-800 dark:text-slate-400 dark:ring-slate-800 md:h-44 md:w-44">
                    {member.photoUrl ? (
                      <img
                        src={member.photoUrl}
                        alt={member.name}
                        className="h-full w-full object-cover"
                      />
                    ) : member.name === 'TBC' ? (
                      '?'
                    ) : (
                      member.name.charAt(0)
                    )}
                  </div>
                  <h3 className="mt-6 text-xl font-bold">{t(`roles.${member.roleKey}`)}</h3>
                  <p className="mt-2 text-base text-slate-500">{member.name}</p>
                </div>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </div>
    </div>
  );
}
