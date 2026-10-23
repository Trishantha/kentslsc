import type Stripe from 'stripe';

/**
 * Map a succeeded PaymentIntent onto a Checkout-Session-shaped object so the
 * domain fulfilment handlers (which key off session metadata and ids) work
 * unchanged for Payment Element checkouts. The PaymentIntent must have been
 * retrieved with its charge expanded, because webhook/search payloads do not
 * include billing details.
 */
export function buildPseudoCheckoutSession(paymentIntent: Stripe.PaymentIntent): Stripe.Checkout.Session {
  const charge = typeof paymentIntent.latest_charge === 'string' ? null : paymentIntent.latest_charge;

  return {
    id: paymentIntent.id,
    object: 'checkout.session',
    metadata: paymentIntent.metadata ?? {},
    status: 'complete',
    payment_status: 'paid',
    amount_total: paymentIntent.amount,
    amount_subtotal: paymentIntent.amount,
    currency: paymentIntent.currency,
    payment_intent: paymentIntent.id,
    customer_email: charge?.billing_details?.email ?? paymentIntent.receipt_email,
    customer_details: {
      email: charge?.billing_details?.email ?? paymentIntent.receipt_email ?? null,
      name: charge?.billing_details?.name ?? null,
      phone: charge?.billing_details?.phone ?? null,
      address: null,
      tax_exempt: 'none'
    },
    created: paymentIntent.created
  } as Stripe.Checkout.Session;
}
