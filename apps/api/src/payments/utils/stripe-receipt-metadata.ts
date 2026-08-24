import Stripe from 'stripe';
import { PrismaClient } from '@kentslsc/database';

const STRIPE_TIMEOUT_MS = 30000;

export async function setReceiptNumberOnStripePaymentIntent(
  prisma: PrismaClient,
  paymentIntentId: string,
  receiptNumber: string
): Promise<void> {
  const settings = await prisma.paymentSettings.findFirst();
  const secretKey = settings?.stripeSecretKey ?? process.env.STRIPE_SECRET_KEY;
  if (!secretKey) return;

  const stripe = new Stripe(secretKey, {
    apiVersion: '2026-07-29.dahlia',
    timeout: STRIPE_TIMEOUT_MS
  });

  try {
    await stripe.paymentIntents.update(paymentIntentId, {
      metadata: { receiptNumber }
    });
  } catch (err) {
    // Best-effort: the receipt number is already stored in our database.
    // Do not fail the payment creation because of a Stripe metadata update.
    console.warn(`Failed to sync receipt number to Stripe ${paymentIntentId}:`, err);
  }
}
