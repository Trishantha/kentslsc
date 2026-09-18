'use client';

import { LucideIcon, Calendar, Heart, Briefcase, Users, Star } from 'lucide-react';
import type { FeaturesBlock } from '@kentslsc/shared';
import { FadeIn } from '@/components/ui/FadeIn';

interface Props {
  block: FeaturesBlock;
}

const iconMap: Record<string, LucideIcon> = {
  Calendar,
  Heart,
  Briefcase,
  Users,
  Star
};

export default function FeaturesBlockComponent({ block }: Props) {
  const { title, features = [] } = block;

  return (
    <section className="px-4 py-16 md:px-6">
      <div className="mx-auto max-w-7xl">
        {title && <h2 className="section-title text-center">{title}</h2>}
        <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {features.map((feature, idx) => {
            const Icon = iconMap[feature.icon] || Star;
            return (
              <FadeIn key={idx} delay={idx * 0.05} className="glass-card p-6">
                <Icon className="h-8 w-8 text-neon-blue" />
                <h3 className="mt-4 text-xl font-bold">{feature.title}</h3>
                <p className="mt-2 text-sm text-slate-700 dark:text-slate-400">{feature.description}</p>
              </FadeIn>
            );
          })}
        </div>
      </div>
    </section>
  );
}
