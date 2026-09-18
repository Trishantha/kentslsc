'use client';

import { useEffect, useState, Component, type FormEvent, type ReactNode, type ErrorInfo } from 'react';
import { useSearchParams } from 'next/navigation';
import { loadStripe, type Stripe } from '@stripe/stripe-js';
import {
  Elements,
  ExpressCheckoutElement,
  PaymentElement,
  useStripe,
  useElements
} from '@stripe/react-stripe-js';
import { Loader2 } from 'lucide-react';
import axios from 'axios';
import { api } from '@/lib/api';
import { formatCurrency } from '@/lib/utils';

interface PaymentIntentDetail {
  id: string;
  status: string | null;
  amount: number;
  currency: string | null;
  description: string | null;
  customerEmail: string | null;
  netAmount: number;
  processingFee: number;
  grossAmount: number;
  returnUrl: string | null;
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

function CheckoutForm({ detail }: { detail: PaymentIntentDetail }) {
  const stripe = useStripe();
  const elements = useElements();
  const [email, setEmail] = useState(detail.customerEmail ?? '');
  const [error, setError] = useState<string | null>(null);
  const [pendingMessage, setPendingMessage] = useState<string | null>(null);
  const [isPaying, setIsPaying] = useState(false);
  const [expressAvailable, setExpressAvailable] = useState(false);

  // Wallets (Apple Pay / Google Pay) only need the billing email, which the
  // Payment Element collects; card payments need it passed at confirm time.
  const emailRequired = !detail.customerEmail;

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!stripe || !elements) return;

    if (emailRequired && !email.trim()) {
      setError('Please enter your email address so we can send you a receipt.');
      return;
    }

    setIsPaying(true);
    setError(null);
    setPendingMessage(null);

    try {
      // if_required: redirect-based methods (3DS cards) still navigate to
      // return_url; inline methods (Bacs Direct Debit, Pay by Bank) resolve
      // with the PaymentIntent so we can handle their non-redirect states.
      const { error: confirmError, paymentIntent } = await stripe.confirmPayment({
        elements,
        redirect: 'if_required',
        confirmParams: {
          return_url: detail.returnUrl ?? window.location.href,
          ...(email.trim()
            ? { payment_method_data: { billing_details: { email: email.trim() } } }
            : {})
        }
      });

      if (confirmError) {
        setError(confirmError.message ?? 'Payment failed. Please try again.');
        setIsPaying(false);
        return;
      }

      // Non-redirect methods resolve here instead of navigating to return_url.
      // Only a succeeded intent may claim the success URL: `processing`
      // (Bacs Direct Debit clearing, Pay by Bank awaiting transfer) has not
      // moved money yet, and sending the payer to ?success=1 would make the
      // thank-you banner lie about an unpaid donation.
      if (paymentIntent) {
        if (paymentIntent.status === 'succeeded') {
          window.location.assign(detail.returnUrl ?? window.location.href);
          return;
        }
        if (paymentIntent.status === 'processing' || paymentIntent.status === 'requires_action') {
          setPendingMessage(
            'Follow the payment instructions above to complete your payment. We will confirm it automatically once the funds reach us.'
          );
        }
        setIsPaying(false);
      }
      // Redirect-based methods (cards with 3DS, wallets) have already sent
      // the browser to return_url at this point.
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Payment failed. Please try again.');
      setIsPaying(false);
    }
  };

  const handleExpressConfirm = async () => {
    if (!stripe || !elements) return;
    setIsPaying(true);
    setError(null);
    const { error: confirmError } = await stripe.confirmPayment({
      elements,
      confirmParams: {
        return_url: detail.returnUrl ?? window.location.href
      }
    });
    if (confirmError) {
      setError(confirmError.message ?? 'Payment failed. Please try again.');
      setIsPaying(false);
    }
    // On success Stripe redirects to return_url; no further handling needed.
  };

  return (
    <div>
      {expressAvailable && (
        <div className="mb-2">
          <ExpressCheckoutElement
            options={{ paymentMethodOrder: ['apple_pay', 'google_pay'] }}
            onReady={({ availablePaymentMethods }) =>
              setExpressAvailable(Boolean(availablePaymentMethods))
            }
            onConfirm={handleExpressConfirm}
            onCancel={() => setIsPaying(false)}
          />
          <div className="my-5 flex items-center gap-3 text-xs uppercase tracking-wide text-slate-500">
            <span className="h-px flex-1 bg-white/10" />
            or pay with card
            <span className="h-px flex-1 bg-white/10" />
          </div>
        </div>
      )}
      <form onSubmit={handleSubmit}>
        {/* The API creates intents with an explicit method list per flow
            (card everywhere; fundraising adds Bacs Direct Debit and Pay by
            Bank), so no dashboard-auto-enabled methods appear here.
            defaultCollapsed keeps the accordion to one row per method; the
            row headers are Stripe's own expand/collapse toggle. */}
        <PaymentElement
          options={{
            layout: { type: 'accordion', defaultCollapsed: true },
            ...(detail.customerEmail
              ? { defaultValues: { billingDetails: { email: detail.customerEmail } } }
              : {})
          }}
        />

        {emailRequired && (
          <div className="mt-4">
            <label htmlFor="checkout-email" className="mb-1 block text-sm text-slate-600 dark:text-slate-400">
              Email for your receipt
            </label>
            <input
              id="checkout-email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm outline-none focus:border-neon-blue"
              placeholder="you@example.com"
            />
          </div>
        )}

        {error && (
          <div className="mt-4 rounded-xl border border-red-500/20 bg-red-500/10 p-3 text-sm text-red-600 dark:text-red-400">
            {error}
          </div>
        )}

        {pendingMessage && (
          <div className="mt-4 rounded-xl border border-amber-500/20 bg-amber-500/10 p-3 text-sm text-amber-700 dark:text-amber-300">
            {pendingMessage}
          </div>
        )}

        <button
          type="submit"
          disabled={!stripe || isPaying}
          className="mt-6 w-full rounded-xl bg-neon-blue px-4 py-3 font-semibold text-white transition-opacity disabled:opacity-50"
        >
          {isPaying ? (
            <span className="inline-flex items-center justify-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin" /> Processing…
            </span>
          ) : (
            `Pay ${formatCurrency(detail.grossAmount / 100)}`
          )}
        </button>
      </form>
    </div>
  );
}

export default function CheckoutPage() {
  const searchParams = useSearchParams();
  const paymentIntentId = searchParams.get('payment_intent');
  const clientSecret = searchParams.get('client_secret');
  const [stripePromise, setStripePromise] = useState<Stripe | null>(null);
  const [detail, setDetail] = useState<PaymentIntentDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoadingStripe, setIsLoadingStripe] = useState(false);

  useEffect(() => {
    if (!clientSecret || !paymentIntentId) {
      setError('Invalid checkout session. Please start again.');
      return;
    }

    let cancelled = false;

    async function init() {
      try {
        if (!paymentIntentId || !clientSecret) return;

        const [configRes, detailRes] = await Promise.all([
          api.get<{ publishableKey: string | null }>('/payments/stripe-config'),
          api.get<PaymentIntentDetail>(
            `/payments/payment-intent/${paymentIntentId}?client_secret=${encodeURIComponent(clientSecret)}`
          )
        ]);

        if (cancelled) return;

        if (!configRes.data.publishableKey) {
          setError('Stripe is not configured.');
          return;
        }

        if (configRes.data.publishableKey.startsWith('sk_')) {
          setError(
            'Stripe is misconfigured: a secret key is being used instead of a publishable key. Please update the payment settings.'
          );
          return;
        }

        const status = detailRes.data.status;
        if (status === 'succeeded') {
          setError('This payment has already been completed.');
          return;
        }
        if (status === 'canceled') {
          setError('This payment has been canceled. Please start again.');
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
          setDetail(detailRes.data);
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
  }, [clientSecret, paymentIntentId]);

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

  if (!clientSecret || !paymentIntentId) {
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

          {detail && (
            <div className="mb-6 rounded-xl border border-white/10 bg-white/5 p-4 text-sm">
              <div className="flex justify-between border-b border-white/10 py-2">
                <span className="text-slate-600 dark:text-slate-400">
                  {detail.description ?? 'Payment'}
                </span>
                <span className="font-medium">{formatCurrency(detail.netAmount / 100)}</span>
              </div>
              {detail.processingFee > 0 && (
                <div className="flex justify-between border-b border-white/10 py-2">
                  <span className="text-slate-600 dark:text-slate-400">Processing fee</span>
                  <span className="font-medium">{formatCurrency(detail.processingFee / 100)}</span>
                </div>
              )}
              <div className="flex justify-between py-2 font-semibold">
                <span>Total to pay</span>
                <span>{formatCurrency(detail.grossAmount / 100)}</span>
              </div>
              {detail.customerEmail && (
                <p className="mt-2 text-xs text-slate-500">Paying as {detail.customerEmail}</p>
              )}
            </div>
          )}

          {stripePromise && detail ? (
            <div className="relative">
              {isLoadingStripe && (
                <div className="absolute inset-0 flex items-center justify-center bg-transparent">
                  <Loader2 className="h-8 w-8 animate-spin text-neon-blue" />
                </div>
              )}
              <CheckoutErrorBoundary
                onError={(err) => {
                  setError(`Payment form failed to load: ${err.message}`);
                }}
              >
                <Elements stripe={stripePromise} options={{ clientSecret }}>
                  <CheckoutForm detail={detail} />
                </Elements>
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
