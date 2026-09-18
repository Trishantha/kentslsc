'use client';

import { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { DependantsSummary } from '@/components/dashboard/DependantsSummary';
import { QuickActions } from '@/components/dashboard/QuickActions';
import { TicketsPreview } from '@/components/dashboard/TicketsPreview';
import { useMyMembership } from '@/components/dashboard/useMyMembership';
import { api } from '@/lib/api';
import { inferPaymentProvider } from '@/lib/payments';

const MEMBERSHIP_CONFIRMATION_TIMEOUT_MS = 2 * 60 * 1000;

export default function DashboardPage() {
  const queryClient = useQueryClient();
  const searchParams = useSearchParams();

  const membershipParam = searchParams.get('membership');
  const sessionIdParam = searchParams.get('session_id');
  const confirmTokenParam = searchParams.get('confirm_token');
  const providerParam = searchParams.get('provider') ?? (sessionIdParam ? inferPaymentProvider(sessionIdParam) : 'stripe');
  const isReturningFromCheckout = membershipParam === 'success';

  // Stripe confirms asynchronously, so give it a bounded window to land before
  // we stop polling and tell the member to check back later.
  const [pollingExpired, setPollingExpired] = useState(false);

  useEffect(() => {
    if (!isReturningFromCheckout) return;
    const timer = setTimeout(() => setPollingExpired(true), MEMBERSHIP_CONFIRMATION_TIMEOUT_MS);
    return () => clearTimeout(timer);
  }, [isReturningFromCheckout]);

  const { data: membership, error } = useMyMembership({
    pollUntilPaid: isReturningFromCheckout && !pollingExpired
  });

  const confirmMembershipPayment = useMutation({
    mutationFn: async ({ sessionId, provider, confirmToken }: { sessionId: string; provider: string; confirmToken?: string | null }) => {
      const res = await api.post('/payments/confirm-session', { sessionId, provider, confirmToken });
      return res.data;
    },
    // The confirmation endpoint is idempotent and retry-safe, so a transient
    // failure should not leave the membership stuck as unpaid.
    retry: 3,
    retryDelay: 2000,
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['my-membership'] });
    }
  });

  // Confirming is a one-shot side effect per checkout session. Keeping the
  // mutation object out of the dependency list and guarding with a ref stops
  // the effect re-firing every time the mutation state changes.
  const confirmedSessionRef = useRef<string | null>(null);
  const confirmMutate = confirmMembershipPayment.mutate;

  useEffect(() => {
    if (membershipParam) {
      queryClient.invalidateQueries({ queryKey: ['my-membership'] });
    }
  }, [membershipParam, queryClient]);

  useEffect(() => {
    if (!isReturningFromCheckout || !sessionIdParam) return;
    if (confirmedSessionRef.current === sessionIdParam) return;

    confirmedSessionRef.current = sessionIdParam;
    confirmMutate({ sessionId: sessionIdParam, provider: providerParam, confirmToken: confirmTokenParam });
  }, [isReturningFromCheckout, sessionIdParam, providerParam, confirmTokenParam, confirmMutate]);

  const isAwaitingPaymentConfirmation = isReturningFromCheckout && !membership?.paidAt;

  return (
    <div className="mx-auto max-w-5xl">
      <h1 className="section-title">Member Dashboard</h1>
      <p className="mt-4 text-slate-700 dark:text-slate-400">
        Manage your profile, view your membership details, and explore member benefits.
      </p>

      {isReturningFromCheckout && (
        <div
          className={
            isAwaitingPaymentConfirmation
              ? 'mt-6 rounded-xl border border-amber-500/20 bg-amber-500/10 p-4 text-sm text-amber-500'
              : 'mt-6 rounded-xl border border-green-500/20 bg-green-500/10 p-4 text-sm text-green-500'
          }
        >
          {isAwaitingPaymentConfirmation
            ? pollingExpired
              ? 'We have not been able to confirm your payment yet. It can take a few minutes — please refresh this page shortly, and contact us if it still does not appear.'
              : 'Thanks for your payment. We are confirming it with the payment provider — this page updates automatically.'
            : 'Your payment has been confirmed. Thank you!'}
        </div>
      )}

      {error && (
        <div className="mt-6 rounded-xl border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-400">
          We could not load your membership details right now. You can still use the rest of the dashboard.
        </div>
      )}

      <div className="mt-8">
        <QuickActions />
      </div>

      <div className="mt-10 grid gap-6 lg:grid-cols-2">
        <div>
          <DependantsSummary />
        </div>
        <div>
          <TicketsPreview />
        </div>
      </div>
    </div>
  );
}
