'use client';

import type { ElementType } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { MessageSquare, Ticket, CreditCard, Vote, Store, ArrowRight } from 'lucide-react';
import { MembershipFeature, membershipFeatureLabels } from '@kentslsc/shared';
import type { MembershipResponse } from './types';

interface UpsellOption {
  feature: MembershipFeature;
  icon: ElementType;
}

const upsellOptions: UpsellOption[] = [
  { feature: MembershipFeature.FORUM_POST, icon: MessageSquare },
  { feature: MembershipFeature.TICKETS_PURCHASE, icon: Ticket },
  { feature: MembershipFeature.MEMBER_CARD, icon: CreditCard },
  { feature: MembershipFeature.VOTING_RIGHTS, icon: Vote },
  { feature: MembershipFeature.DIRECTORY_LISTING, icon: Store }
];

interface UpgradePromptProps {
  membership: MembershipResponse;
}

export function UpgradePrompt({ membership }: UpgradePromptProps) {
  const missing = upsellOptions.filter(
    (option) => !membership.membershipType.features.includes(option.feature)
  );

  if (missing.length === 0) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.3 }}
    >
      <h2 className="section-title text-2xl">Unlock more benefits</h2>
      <p className="mt-2 text-slate-700 dark:text-slate-400">
        Your current plan does not include these features. Upgrade to get the full member experience.
      </p>

      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {missing.map((option) => {
          const def = membershipFeatureLabels[option.feature];
          const Icon = option.icon;
          return (
            <div key={option.feature} className="glass-card flex flex-col p-5">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-neon-gold/10 text-neon-gold">
                  <Icon className="h-5 w-5" />
                </div>
                <h3 className="font-semibold">{def?.label ?? option.feature}</h3>
              </div>
              <p className="mt-3 flex-1 text-sm text-slate-700 dark:text-slate-400">
                {def?.description ?? ''}
              </p>
              <Link
                href="/membership"
                className="mt-4 inline-flex items-center text-sm font-medium text-neon-blue hover:underline"
              >
                Upgrade <ArrowRight className="ml-1 h-4 w-4" />
              </Link>
            </div>
          );
        })}
      </div>
    </motion.div>
  );
}
