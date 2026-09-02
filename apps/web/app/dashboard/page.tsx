'use client';

import { useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Loader2 } from 'lucide-react';
import { BecomeMemberCTA } from '@/components/dashboard/BecomeMemberCTA';
import { MembershipSummary } from '@/components/dashboard/MembershipSummary';
import { QuickActions } from '@/components/dashboard/QuickActions';
import { TicketsPreview } from '@/components/dashboard/TicketsPreview';
import { UpgradePrompt } from '@/components/dashboard/UpgradePrompt';
import { useMyMembership } from '@/components/dashboard/useMyMembership';
import { api } from '@/lib/api';

export default function DashboardPage() {
  const queryClient = useQueryClient();
  const searchParams = useSearchParams();
  const { data: membership, isLoading, error } = useMyMembership();

  const confirmMembershipPayment = useMutation({
    mutationFn: async ({ sessionId, provider }: { sessionId: string; provider: string }) => {
      const res = await api.post('/payments/confirm-session', { sessionId, provider });
      return res.data;
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['my-membership'] });
    }
  });

  const membershipParam = searchParams.get('membership');
  const sessionIdParam = searchParams.get('session_id');
  const providerParam = searchParams.get('provider') ?? 'stripe';

  useEffect(() => {
    if (membershipParam) {
      queryClient.invalidateQueries({ queryKey: ['my-membership'] });
    }

    if (membershipParam === 'success' && sessionIdParam && !confirmMembershipPayment.isPending) {
      confirmMembershipPayment.mutate({ sessionId: sessionIdParam, provider: providerParam });
    }
  }, [membershipParam, sessionIdParam, providerParam, queryClient, confirmMembershipPayment]);

  return (
    <div className="mx-auto max-w-5xl">
      <h1 className="section-title">Member Dashboard</h1>
      <p className="mt-4 text-slate-700 dark:text-slate-400">
        Manage your profile, view your membership details, and explore member benefits.
      </p>

      {error && (
        <div className="mt-6 rounded-xl border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-400">
          We could not load your membership details right now. You can still use the rest of the dashboard.
        </div>
      )}

      <div className="mt-8">
        <QuickActions />
      </div>

      <div className="mt-10 grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          {isLoading ? (
            <div className="glass-card flex items-center justify-center p-12">
              <Loader2 className="h-8 w-8 animate-spin text-neon-blue" />
            </div>
          ) : membership ? (
            <MembershipSummary />
          ) : (
            <BecomeMemberCTA />
          )}
        </div>
        <div className="lg:col-span-1">
          <TicketsPreview />
        </div>
      </div>

      {membership && (
        <div className="mt-10">
          <UpgradePrompt membership={membership} />
        </div>
      )}
    </div>
  );
}
