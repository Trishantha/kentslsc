'use client';

import { MembershipCard } from '@/components/dashboard/MembershipCard';
import { UpgradePrompt } from '@/components/dashboard/UpgradePrompt';
import { BecomeMemberCTA } from '@/components/dashboard/BecomeMemberCTA';
import { useMyMembership } from '@/components/dashboard/useMyMembership';

export default function MembershipPage() {
  const { data: membership } = useMyMembership();

  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="section-title">My Membership</h1>
      <p className="mt-4 text-slate-700 dark:text-slate-400">
        View your membership status, manage your subscription, and download your digital card.
      </p>

      <div className="mt-8">
        {membership ? (
          <>
            <MembershipCard />
            <div className="mt-10">
              <UpgradePrompt membership={membership} />
            </div>
          </>
        ) : (
          <BecomeMemberCTA />
        )}
      </div>
    </div>
  );
}
