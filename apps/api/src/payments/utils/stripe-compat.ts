import type Stripe from 'stripe';

/**
 * Compatibility helpers for Stripe API version `2025-03-31.basil` and later
 * (the app pins `2026-07-29.dahlia`).
 *
 * Two breaking changes affect the membership payment flow:
 * - `Invoice.payment_intent` was removed in favour of `Invoice.payments`, and
 *   the property can no longer be expanded (`latest_invoice.payment_intent`
 *   now raises an invalid request error).
 * - `Subscription.current_period_end` moved onto the subscription items.
 * - `Invoice.subscription` moved to `Invoice.parent.subscription_details.subscription`.
 *
 * These helpers read the new locations and fall back to the legacy ones so
 * historical payloads (replayed webhooks, stored events) keep working.
 */

/** Resolve the PaymentIntent id attached to an invoice, if any. */
export function resolveInvoicePaymentIntentId(
  invoice: Stripe.Invoice | null | undefined
): string | null {
  if (!invoice) return null;
  const invoiceAny = invoice as any;

  const legacy = invoiceAny.payment_intent;
  const legacyId = typeof legacy === 'string' ? legacy : legacy?.id;
  if (legacyId) return legacyId;

  const payments = invoiceAny.payments?.data ?? [];
  for (const entry of payments) {
    const paymentIntent = entry?.payment?.payment_intent;
    const id = typeof paymentIntent === 'string' ? paymentIntent : paymentIntent?.id;
    if (id) return id;
  }

  return null;
}

/** Resolve the subscription id an invoice belongs to, if any. */
export function resolveInvoiceSubscriptionId(
  invoice: Stripe.Invoice | null | undefined
): string | null {
  if (!invoice) return null;
  const invoiceAny = invoice as any;

  const legacy = invoiceAny.subscription;
  const legacyId = typeof legacy === 'string' ? legacy : legacy?.id;
  if (legacyId) return legacyId;

  const parent = invoiceAny.parent?.subscription_details?.subscription;
  const parentId = typeof parent === 'string' ? parent : parent?.id;
  if (parentId) return parentId;

  const lineParent = invoiceAny.lines?.data?.[0]?.parent?.subscription_item_details?.subscription;
  const lineId = typeof lineParent === 'string' ? lineParent : lineParent?.id;
  return lineId ?? null;
}

/**
 * Resolve the current billing period end of a subscription as a Date, or
 * `null` when Stripe did not return a usable timestamp.
 */
export function resolveSubscriptionPeriodEnd(
  subscription: Stripe.Subscription | null | undefined
): Date | null {
  if (!subscription) return null;
  const subscriptionAny = subscription as any;

  const candidates: unknown[] = [
    ...(subscription.items?.data ?? []).map((item) => (item as any)?.current_period_end),
    subscriptionAny.current_period_end
  ];

  for (const candidate of candidates) {
    if (typeof candidate === 'number' && Number.isFinite(candidate) && candidate > 0) {
      return new Date(candidate * 1000);
    }
  }

  return null;
}
