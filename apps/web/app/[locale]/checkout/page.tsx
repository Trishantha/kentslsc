'use client';

import { useEffect, useState, Component, type ReactNode, type ErrorInfo } from 'react';
import { useSearchParams } from 'next/navigation';
import { loadStripe, type Stripe } from '@stripe/stripe-js';
import { EmbeddedCheckout, EmbeddedCheckoutProvider } from '@stripe/react-stripe-js';
import { Loader2 } from 'lucide-react';
import axios from 'axios';
import { api } from '@/lib/api';
import { formatCurrency } from '@/lib/utils';

interface CheckoutSession {
  id: string;
  status: string | null;
  amountTotal: number;
  currency: string;
  customerEmail: string | null;
  lineItems?: Array<{
    description: string | null;
    amount: number;
    quantity: number | null;
  }>;
}

interface CheckoutErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

class CheckoutErrorBoundary extends Component<
  { children: ReactNode; onError: (error: Error) => void },
  CheckoutErrorBoundaryState
> {
  state: CheckoutErrorBoundaryState = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): CheckoutErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, _errorInfo: ErrorInfo) {
    this.props.onError(error);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="rounded-xl border border-red-500/20 bg-red-500/10 p-4 text-center text-sm text-red-600 dark:text-red-400">
          The payment form could not be loaded. Please refresh the page or try again later.
        </div>
      );
    }
    return this.props.children;
  }
}

function getSessionMode(sessionId: string): 'live' | 'test' | 'unknown' {
  if (sessionId.startsWith('cs_live_')) return 'live';
  if (sessionId.startsWith('cs_test_')) return 'test';
  return 'unknown';
}

function validateStripeKeyMatchesSession(publishableKey: string, sessionId: string): string | null {
  if (publishableKey.startsWith('sk_')) {
    return 'Stripe is misconfigured: a secret key is being used instead of a publishable key. Please update the payment settings.';
  }
  const mode = getSessionMode(sessionId);
  if (mode === 'unknown') return 'Invalid checkout session ID.';
  if (mode === 'live' && !publishableKey.startsWith('pk_live_')) {
    return 'Stripe is configured for test mode, but this is a live checkout session.';
  }
  if (mode === 'test' && !publishableKey.startsWith('pk_test_')) {
    return 'Stripe is configured for live mode, but this is a test checkout session.';
  }
  return null;
}

export default function CheckoutPage() {
  const searchParams = useSearchParams();
  const sessionId = searchParams.get('session_id');
  const clientSecret = searchParams.get('client_secret');
  const [stripePromise, setStripePromise] = useState<Stripe | null>(null);
  const [session, setSession] = useState<CheckoutSession | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoadingStripe, setIsLoadingStripe] = useState(false);

  useEffect(() => {
    if (!clientSecret || !sessionId) {
      setError('Invalid checkout session. Please start again.');
      return;
    }

    let cancelled = false;

    async function init() {
      try {
        if (!sessionId || !clientSecret) return;

        const [configRes, sessionRes] = await Promise.all([
          api.get<{ publishableKey: string | null }>('/payments/stripe-config'),
          api.get<CheckoutSession>(`/payments/checkout-session/${sessionId}`)
        ]);

        if (cancelled) return;

        if (!configRes.data.publishableKey) {
          setError('Stripe is not configured.');
          return;
        }

        const keyError = validateStripeKeyMatchesSession(configRes.data.publishableKey, sessionId);
        if (keyError) {
          setError(keyError);
          return;
        }

        const status = sessionRes.data.status;
        if (status === 'complete') {
          setError('This payment has already been completed.');
          return;
        }
        if (status === 'expired') {
          setError('This checkout session has expired. Please start again.');
          return;
        }
        if (status && status !== 'open') {
          setError(`This checkout session cannot be used (status: ${status}). Please start again.`);
          return;
        }

        setIsLoadingStripe(true);
        try {
          const stripe = await loadStripe(configRes.data.publishableKey);
          if (cancelled) return;
          if (!stripe) {
            setError('Stripe could not be initialised. Please check your browser extensions or network connection.');
            return;
          }
          setStripePromise(stripe);
          setSession(sessionRes.data);
        } catch (err) {
          if (!cancelled) {
            setError(`Stripe could not be initialised: ${err instanceof Error ? err.message : 'Unknown error'}`);
          }
        } finally {
          if (!cancelled) {
            setIsLoadingStripe(false);
          }
        }
      } catch (err) {
        if (!cancelled) {
          if (axios.isAxiosError(err) && err.response?.status === 429) {
            setError('Too many requests. Please wait a moment and try again.');
          } else {
            setError('Could not load checkout details.');
          }
        }
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
            <div className="relative min-h-[500px]">
              {(isLoadingStripe || !session) && (
                <div className="absolute inset-0 flex items-center justify-center bg-transparent">
                  <Loader2 className="h-8 w-8 animate-spin text-neon-blue" />
                </div>
              )}
              <CheckoutErrorBoundary
                onError={(err) => {
                  setError(`Payment form failed to load: ${err.message}`);
                }}
              >
                <EmbeddedCheckoutProvider stripe={stripePromise} options={{ clientSecret }}>
                  <EmbeddedCheckout />
                </EmbeddedCheckoutProvider>
              </CheckoutErrorBoundary>
            </div>
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
