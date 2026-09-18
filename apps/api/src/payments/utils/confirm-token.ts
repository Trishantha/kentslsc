import { createHmac, timingSafeEqual } from 'crypto';

/**
 * Signed confirmation token for payment success-return URLs. The token proves
 * the caller holds the full return URL (not just the provider checkout id, which
 * leaks via referrer/analytics/logs), so the public confirm-session backstop can
 * only be triggered by the payer who completed the checkout. Verification is
 * stateless: HMAC-SHA256 of the provider id under a server-only secret.
 */

function secretKey(): string {
  return (
    process.env.PAYMENT_CONFIRM_SECRET ??
    process.env.JWT_SECRET ??
    'insecure-dev-confirm-secret'
  );
}

export function createConfirmToken(providerCheckoutId: string): string {
  return createHmac('sha256', secretKey()).update(providerCheckoutId).digest('base64url');
}

export function verifyConfirmToken(providerCheckoutId: string, token: string | undefined | null): boolean {
  if (!token || token.length > 200) return false;
  const expected = createConfirmToken(providerCheckoutId);
  const a = Buffer.from(expected);
  const b = Buffer.from(token);
  return a.length === b.length && timingSafeEqual(a, b);
}

export const CONFIRM_TOKEN_PLACEHOLDER = '{CONFIRM_TOKEN}';

/**
 * Ensure a success/return URL carries the confirm-token placeholder. Central so
 * every checkout flow (Stripe sessions, PaymentIntents, GoCardless billing
 * requests) gets it without each caller remembering.
 */
export function withConfirmTokenPlaceholder(url: string): string {
  if (url.includes('confirm_token=') || url.includes(CONFIRM_TOKEN_PLACEHOLDER)) return url;
  return `${url}${url.includes('?') ? '&' : '?'}confirm_token=${CONFIRM_TOKEN_PLACEHOLDER}`;
}
