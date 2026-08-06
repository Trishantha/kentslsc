'use client';

import { motion } from 'framer-motion';
import { Users, Heart, Globe, Calendar, MapPin } from 'lucide-react';

const milestones = [
  {
    year: '2015',
    title: 'The Beginning',
    description:
      'A small group of Sri Lankan families in Kent came together to celebrate Sinhala and Tamil New Year, planting the seed for a thriving community.'
  },
  {
    year: '2017',
    title: 'Officially Formed',
    description:
      'Kent Sri Lankan Social Club was formally established with a mission to preserve heritage, support families, and build lasting friendships.'
  },
  {
    year: '2019',
    title: 'First Charity Dinner',
    description:
      'Hosted our first major fundraising dinner, bringing together hundreds of members and raising vital funds for local causes.'
  },
  {
    year: '2022',
    title: 'Digital Platform',
    description:
      'Launched our community platform to connect members, promote businesses, and make events accessible to everyone in Kent.'
  },
  {
    year: '2024',
    title: 'Looking Ahead',
    description:
      'Expanding programmes for youth, supporting Sri Lankan businesses, and welcoming new members from across the county.'
  }
];

const committee = [
  { role: 'President', name: 'TBC' },
  { role: 'Vice President', name: 'TBC' },
  { role: 'Secretary', name: 'TBC' },
  { role: 'Treasurer', name: 'TBC' },
  { role: 'Events Lead', name: 'TBC' },
  { role: 'Youth Coordinator', name: 'TBC' }
];

const values = [
  {
    icon: Heart,
    title: 'Community First',
    description: 'We put people at the heart of everything we do.'
  },
  {
    icon: Globe,
    title: 'Culture & Heritage',
    description: 'Celebrating Sri Lankan traditions across generations.'
  },
  {
    icon: Users,
    title: 'Inclusivity',
    description: 'A welcoming space for all backgrounds and ages.'
  },
  {
    icon: Calendar,
    title: 'Year-Round Engagement',
    description: 'Events, workshops, and gatherings throughout the year.'
  }
];

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

export default function AboutPage() {
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
          <h1 className="section-title">About Kent Sri Lankan Social Club</h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg text-slate-600 dark:text-slate-300">
            A community-led organisation dedicated to bringing together Sri Lankan families and
            friends across Kent. We celebrate our heritage, support one another, and build bridges
            across generations.
          </p>
        </motion.div>

        <motion.div
          variants={container}
          initial="hidden"
          whileInView="show"
          viewport={{ once: true }}
          className="mt-16 grid gap-6 sm:grid-cols-2 lg:grid-cols-4"
        >
          {values.map((v) => (
            <motion.div key={v.title} variants={fadeUp}>
              <div className="glass-card h-full p-6 text-center">
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-neon-gold/10 text-neon-gold">
                  <v.icon className="h-6 w-6" />
                </div>
                <h3 className="mt-4 text-lg font-bold">{v.title}</h3>
                <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">{v.description}</p>
              </div>
            </motion.div>
          ))}
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="mt-20 glass-card p-8 md:p-10"
        >
          <h2 className="text-2xl font-bold gradient-text">Our Mission</h2>
          <p className="mt-4 text-lg text-slate-600 dark:text-slate-400">
            To preserve and promote Sri Lankan culture, foster friendships, and create a welcoming
            space for everyone in Kent. Through events, fundraising, business promotion, and open
            forums, we strengthen the bonds that make our community extraordinary.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <span className="rounded-full bg-green-700/10 px-3 py-1 text-sm font-medium text-green-700 dark:text-green-400">
              Heritage
            </span>
            <span className="rounded-full bg-orange-500/10 px-3 py-1 text-sm font-medium text-orange-600 dark:text-orange-300">
              Culture
            </span>
            <span className="rounded-full bg-yellow-400/10 px-3 py-1 text-sm font-medium text-yellow-700 dark:text-yellow-300">
              Unity
            </span>
          </div>
        </motion.div>

        <div className="mt-20">
          <h2 className="section-title text-center">Our Journey</h2>
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
              {milestones.map((m, index) => (
                <motion.div
                  key={m.year}
                  variants={fadeUp}
                  className={`relative flex flex-col gap-4 md:flex-row md:items-center ${
                    index % 2 === 0 ? 'md:flex-row-reverse' : ''
                  }`}
                >
                  <div className="flex-1 md:text-right">
                    <div className="glass-card inline-block p-6">
                      <span className="text-sm font-bold text-neon-gold">{m.year}</span>
                      <h3 className="mt-1 text-xl font-bold">{m.title}</h3>
                      <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">{m.description}</p>
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
          <h2 className="section-title text-center">Committee</h2>
          <p className="mx-auto mt-4 max-w-xl text-center text-slate-600 dark:text-slate-400">
            Our volunteer committee works year-round to keep the club running. Member profiles will
            appear here soon.
          </p>
          <motion.div
            variants={container}
            initial="hidden"
            whileInView="show"
            viewport={{ once: true }}
            className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3"
          >
            {committee.map((member) => (
              <motion.div key={member.role} variants={fadeUp}>
                <div className="glass-card p-6 text-center transition-transform hover:-translate-y-1">
                  <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-gradient-to-br from-slate-200 to-slate-300 text-2xl font-bold text-slate-500 dark:from-slate-700 dark:to-slate-800 dark:text-slate-400">
                    {member.name === 'TBC' ? '?' : member.name.charAt(0)}
                  </div>
                  <h3 className="mt-4 text-lg font-bold">{member.role}</h3>
                  <p className="mt-1 text-sm text-slate-500">{member.name}</p>
                </div>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </div>
    </div>
  );
}
