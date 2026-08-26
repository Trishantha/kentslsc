/**
 * Backfill missing paymentMethod / paidAt on memberships that have been paid.
 *
 * Two sources are checked:
 *   1. Local Payment ledger rows with status COMPLETED linked to a membership.
 *   2. Stripe subscriptions attached to memberships (if no local Payment row).
 *
 * Usage:
 *   pnpm --filter @kentslsc/database exec tsx ../../apps/api/scripts/backfill-membership-payment-status.ts
 *
 * Flags:
 *   --dry-run            Log what would be updated without writing to the DB.
 *   --only=payments      Only backfill from the local Payment ledger.
 *   --only=stripe        Only backfill from Stripe subscription data.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import Stripe from 'stripe';
import { PrismaClient, PaymentStatus } from '@kentslsc/database';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables from the workspace root .env if they are not already set.
const envPath = path.resolve(__dirname, '../../../.env');
if (fs.existsSync(envPath)) {
  const envText = fs.readFileSync(envPath, 'utf-8');
  for (const line of envText.split('\n')) {
    const match = line.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
    if (match) {
      const [, key, value] = match;
      if (process.env[key] === undefined && value !== '') {
        process.env[key] = value;
      }
    }
  }
}

const DRY_RUN = process.argv.includes('--dry-run');
const ONLY = parseArg('only');

function parseArg(name: string): string | undefined {
  const prefix = `--${name}=`;
  const arg = process.argv.find((a) => a.startsWith(prefix));
  return arg?.slice(prefix.length);
}

interface BackfillResult {
  updatedFromPayments: number;
  updatedFromStripe: number;
  skipped: number;
  errors: string[];
}

function emptyResult(): BackfillResult {
  return { updatedFromPayments: 0, updatedFromStripe: 0, skipped: 0, errors: [] };
}

async function getStripeClient(prisma: PrismaClient): Promise<Stripe | null> {
  const settings = await prisma.paymentSettings.findFirst();
  const secretKey = settings?.stripeSecretKey ?? process.env.STRIPE_SECRET_KEY;
  if (!secretKey) {
    console.warn('Stripe secret key not configured. Skipping Stripe-based backfill.');
    return null;
  }
  return new Stripe(secretKey, { apiVersion: '2026-07-29.dahlia', timeout: 30_000 });
}

async function backfillFromPayments(prisma: PrismaClient): Promise<number> {
  const memberships = await prisma.membership.findMany({
    where: {
      deletedAt: null,
      OR: [{ paymentMethod: null }, { paidAt: null }]
    },
    include: {
      payments: {
        where: { paymentStatus: PaymentStatus.COMPLETED, deletedAt: null },
        orderBy: { purchasedAt: 'asc' },
        take: 1
      }
    }
  });

  let updated = 0;
  for (const membership of memberships) {
    const firstPayment = membership.payments[0];
    if (!firstPayment) continue;

    const paymentMethod = firstPayment.paymentMethod || firstPayment.paymentChannel || 'stripe';
    const paidAt = firstPayment.purchasedAt ?? firstPayment.createdAt;

    if (DRY_RUN) {
      console.log(
        `[DRY-RUN] membership ${membership.membershipId}: set paymentMethod=${paymentMethod}, paidAt=${paidAt.toISOString()}`
      );
      updated++;
      continue;
    }

    await prisma.membership.update({
      where: { id: membership.id },
      data: {
        paymentMethod,
        paidAt
      }
    });
    updated++;
  }

  return updated;
}

async function backfillFromStripe(
  prisma: PrismaClient,
  stripe: Stripe
): Promise<number> {
  const memberships = await prisma.membership.findMany({
    where: {
      deletedAt: null,
      stripeSubscriptionId: { not: null },
      OR: [{ paymentMethod: null }, { paidAt: null }]
    }
  });

  let updated = 0;
  for (const membership of memberships) {
    try {
      const subscription = await stripe.subscriptions.retrieve(membership.stripeSubscriptionId!, {
        expand: ['latest_invoice']
      });

      if (subscription.status !== 'active' && subscription.status !== 'trialing') {
        continue;
      }

      const latestInvoice = subscription.latest_invoice as Stripe.Invoice | undefined | null;
      const paidAt =
        latestInvoice?.status_transitions?.paid_at
          ? new Date(latestInvoice.status_transitions.paid_at * 1000)
          : subscription.start_date
            ? new Date(subscription.start_date * 1000)
            : membership.createdAt;

      if (DRY_RUN) {
        console.log(
          `[DRY-RUN] membership ${membership.membershipId}: set paymentMethod=stripe, paidAt=${paidAt.toISOString()} (stripe subscription ${subscription.id})`
        );
        updated++;
        continue;
      }

      await prisma.membership.update({
        where: { id: membership.id },
        data: {
          paymentMethod: 'stripe',
          paidAt,
          subscriptionStatus: subscription.status
        }
      });
      updated++;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.warn(`Stripe lookup failed for ${membership.membershipId}: ${message}`);
    }
  }

  return updated;
}

async function main(): Promise<void> {
  const prisma = new PrismaClient();
  const result = emptyResult();

  try {
    if (!ONLY || ONLY === 'payments') {
      result.updatedFromPayments = await backfillFromPayments(prisma);
    }

    if (!ONLY || ONLY === 'stripe') {
      const stripe = await getStripeClient(prisma);
      if (stripe) {
        result.updatedFromStripe = await backfillFromStripe(prisma, stripe);
      }
    }

    console.log('Backfill complete:');
    console.log(`  Updated from Payment ledger: ${result.updatedFromPayments}`);
    console.log(`  Updated from Stripe:         ${result.updatedFromStripe}`);
    console.log(`  Errors:                      ${result.errors.length}`);

    if (DRY_RUN) {
      console.log('Dry run complete — no database writes were made.');
    }
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
