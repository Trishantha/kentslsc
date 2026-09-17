import type { PaymentMethodProvider } from '@kentslsc/shared';

export type PaymentProvider = PaymentMethodProvider;

/**
 * Success-return URLs carry a session identifier whose prefix identifies the
 * provider: Stripe checkout session ids start with `cs_`, GoCardless billing
 * request ids start with `BR`. Used as a fallback when the return URL has no
 * explicit `provider` param.
 */
export function inferPaymentProvider(sessionId: string): PaymentProvider {
  return sessionId.startsWith('cs_') ? 'stripe' : 'gocardless';
}
