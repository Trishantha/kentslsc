'use client';

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { loadStripe } from '@stripe/stripe-js';
import { EmbeddedCheckout, EmbeddedCheckoutProvider } from '@stripe/react-stripe-js';
import { Loader2 } from 'lucide-react';
import { api } from '@/lib/api';
import { formatCurrency } from '@/lib/utils';

interface CheckoutSession {
  id: string;
  amountTotal: number;
  currency: string;
  customerEmail: string | null;
  lineItems?: Array<{
    description: string | null;
    amount: number;
    quantity: number | null;
  }>;
}

export default function CheckoutPage() {
  const searchParams = useSearchParams();
  const sessionId = searchParams.get('session_id');
  const clientSecret = searchParams.get('client_secret');
  const [stripePromise, setStripePromise] = useState<ReturnType<typeof loadStripe> | null>(null);
  const [session, setSession] = useState<CheckoutSession | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!clientSecret || !sessionId) {
      setError('Invalid checkout session. Please start again.');
      return;
    }

    let cancelled = false;

    async function init() {
      try {
        const [configRes, sessionRes] = await Promise.all([
          api.get<{ publishableKey: string | null }>('/payments/stripe-config'),
          api.get<CheckoutSession>(`/payments/checkout-session/${sessionId}`)
        ]);

        if (!configRes.data.publishableKey) {
          setError('Stripe is not configured.');
          return;
        }

        if (cancelled) return;
        setStripePromise(loadStripe(configRes.data.publishableKey));
        setSession(sessionRes.data);
      } catch {
        setError('Could not load checkout details.');
      }
    }

    init();

    return () => {
      cancelled = true;
    };
  }, [clientSecret, sessionId]);

  const mainLineItem = session?.lineItems?.find(
    (item) => item.description && item.description !== 'Processing fee'
  );
  const feeLineItem = session?.lineItems?.find(
    (item) => item.description === 'Processing fee'
  );

  if (error) {
    return (
      <div className="px-4 py-16 md:px-6">
        <div className="mx-auto max-w-2xl">
          <div className="glass-card p-6 text-center md:p-8">
            <h1 className="text-lg font-semibold">Checkout unavailable</h1>
            <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">{error}</p>
          </div>
        </div>
      </div>
    );
  }

  if (!clientSecret || !sessionId) {
    return (
      <div className="px-4 py-16 md:px-6">
        <div className="mx-auto max-w-2xl">
          <div className="glass-card p-6 text-center md:p-8">
            <h1 className="text-lg font-semibold">Checkout unavailable</h1>
            <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">Invalid checkout session.</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen px-4 py-6 md:px-6 md:py-10">
      <div className="mx-auto w-full max-w-2xl">
        <div className="glass-card overflow-hidden p-4 md:p-8">
          <h1 className="mb-4 text-center text-lg font-semibold md:mb-6 md:text-xl">
            Complete your payment
          </h1>

          {session && (
            <div className="mb-6 rounded-xl border border-white/10 bg-white/5 p-4 text-sm">
              <div className="flex justify-between border-b border-white/10 py-2">
                <span className="text-slate-600 dark:text-slate-400">
                  {mainLineItem?.description ?? 'Payment'}
                </span>
                <span className="font-medium">
                  {formatCurrency((mainLineItem?.amount ?? session.amountTotal) / 100)}
                </span>
              </div>
              {feeLineItem && (
                <div className="flex justify-between border-b border-white/10 py-2">
                  <span className="text-slate-600 dark:text-slate-400">Processing fee</span>
                  <span className="font-medium">{formatCurrency(feeLineItem.amount / 100)}</span>
                </div>
              )}
              <div className="flex justify-between py-2 font-semibold">
                <span>Total to pay</span>
                <span>{formatCurrency(session.amountTotal / 100)}</span>
              </div>
              {session.customerEmail && (
                <p className="mt-2 text-xs text-slate-500">
                  Paying as {session.customerEmail}
                </p>
              )}
            </div>
          )}

          {stripePromise ? (
            <EmbeddedCheckoutProvider stripe={stripePromise} options={{ clientSecret }}>
              <EmbeddedCheckout />
            </EmbeddedCheckoutProvider>
          ) : (
            <div className="flex h-64 items-center justify-center">
              <Loader2 className="h-8 w-8 animate-spin text-neon-blue" />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
