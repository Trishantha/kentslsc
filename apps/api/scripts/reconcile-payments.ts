/**
 * Reconcile legacy payments from Stripe Checkout / PayPal into the unified Payment ledger.
 *
 * This script is designed to be run ONCE after deploying the unified Payment model.
 * It scans the database for revenue-bearing records (tickets, memberships, donations,
 * directory promotions, job publishes) that do not have a linked Payment row and creates
 * one. For Stripe Checkout ticket sessions it can also issue missing tickets if a
 * completed checkout has no matching Ticket rows.
 *
 * Usage:
 *   pnpm --filter @kentslsc/database exec tsx ../../apps/api/scripts/reconcile-payments.ts
 *
 * Flags:
 *   --dry-run            Log what would be created without writing to the DB.
 *   --from=YYYY-MM-DD    Only reconcile records created on or after this date
 *                        (also limits Stripe Checkout session retrieval).
 *   --only=source        Restrict to one source: tickets, memberships, donations,
 *                        directory, jobs.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import crypto from 'node:crypto';
import Stripe from 'stripe';
import {
  PrismaClient,
  PaymentStatus,
  PaymentSourceType,
  TicketStatus,
  Prisma
} from '@kentslsc/database';
import { calculateProcessingFee, DEFAULT_PROCESSING_FEE } from '@kentslsc/shared';

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
const FROM_DATE = parseDateArg('from');

function parseArg(name: string): string | undefined {
  const prefix = `--${name}=`;
  const arg = process.argv.find((a) => a.startsWith(prefix));
  return arg?.slice(prefix.length);
}

function parseDateArg(name: string): Date | undefined {
  const value = parseArg(name);
  if (!value) return undefined;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new Error(`Invalid date for --${name}: ${value}`);
  }
  return date;
}

interface FeeConfig {
  enabled: boolean;
  percent: number;
  fixed: number;
}

interface ReconcileResult {
  created: number;
  skipped: number;
  errors: string[];
}

function emptyResult(): ReconcileResult {
  return { created: 0, skipped: 0, errors: [] };
}

function formatPence(pence: number): string {
  return `£${(pence / 100).toFixed(2)}`;
}

function deriveNetAndFee(grossPence: number, config: FeeConfig): { net: number; fee: number } {
  if (!config.enabled || grossPence <= 0) {
    return { net: grossPence, fee: 0 };
  }
  // Approximate the net amount before the fee was added on top.
  let net = Math.floor((grossPence - config.fixed) / (1 + config.percent / 100));
  if (net < 0) net = 0;
  const { fee } = calculateProcessingFee(net, config);
  return { net: grossPence - fee, fee };
}

async function createPayment(
  tx: Prisma.TransactionClient,
  data: Prisma.PaymentCreateInput
): Promise<void> {
  if (DRY_RUN) return;
  await tx.payment.create({ data });
}

async function getStripeClient(prisma: PrismaClient): Promise<Stripe | null> {
  const settings = await prisma.paymentSettings.findFirst();
  const secretKey = settings?.stripeSecretKey ?? process.env.STRIPE_SECRET_KEY;
  if (!secretKey) {
    console.warn('Stripe secret key not configured. Skipping Stripe-based reconciliation.');
    return null;
  }
  return new Stripe(secretKey, { apiVersion: '2026-07-29.dahlia', timeout: 30_000 });
}

async function getFeeConfig(prisma: PrismaClient): Promise<FeeConfig> {
  const settings = await prisma.paymentSettings.findFirst();
  return {
    enabled: settings?.processingFeeEnabled ?? DEFAULT_PROCESSING_FEE.enabled,
    percent: settings?.processingFeePercent
      ? Number(settings.processingFeePercent)
      : DEFAULT_PROCESSING_FEE.percent,
    fixed: settings?.processingFeeFixed ?? DEFAULT_PROCESSING_FEE.fixed
  };
}

function isStripeCheckoutId(id: string | null | undefined): boolean {
  return typeof id === 'string' && id.startsWith('cs_');
}

/**
 * Update a Payment row with the actual fee and net settlement from Stripe's
 * balance transaction. This makes the revenue report match Stripe's payout
 * reporting instead of the estimated processing fee.
 */
async function syncStripeFeesForSession(
  prisma: PrismaClient,
  stripe: Stripe,
  sessionId: string
): Promise<void> {
  const payment = await prisma.payment.findFirst({
    where: { providerCheckoutId: sessionId, deletedAt: null },
    orderBy: { createdAt: 'desc' }
  });
  if (!payment?.providerPaymentId) return;

  try {
    const pi = await stripe.paymentIntents.retrieve(payment.providerPaymentId, {
      expand: ['latest_charge.balance_transaction']
    });
    const latestCharge = pi.latest_charge;
    if (!latestCharge) return;

    let balanceTransaction: Stripe.BalanceTransaction | string | null | undefined;
    if (typeof latestCharge === 'string') {
      const charge = await stripe.charges.retrieve(latestCharge, {
        expand: ['balance_transaction']
      });
      balanceTransaction = charge.balance_transaction;
    } else {
      balanceTransaction = latestCharge.balance_transaction;
    }

    if (!balanceTransaction) return;

    const tx =
      typeof balanceTransaction === 'string'
        ? await stripe.balanceTransactions.retrieve(balanceTransaction)
        : balanceTransaction;

    await prisma.payment.update({
      where: { id: payment.id },
      data: {
        processingFee: tx.fee / 100,
        netAmount: tx.net / 100
      }
    });
  } catch (err) {
    console.warn(
      `  Could not sync Stripe fees for session ${sessionId}: ${(err as Error).message}`
    );
  }
}

/**
 * Reconcile tickets that exist in the DB but have no linked Payment row.
 * This happens when a webhook failed after the Ticket was issued, or when a
 * legacy ticket row predates the Payment ledger.
 */
async function reconcileOrphanedTickets(
  prisma: PrismaClient,
  stripe: Stripe,
  feeConfig: FeeConfig,
  result: ReconcileResult
): Promise<void> {
  const where: Prisma.TicketWhereInput = {
    deletedAt: null,
    paymentId: null,
    stripeSessionId: { not: null }
  };
  if (FROM_DATE) {
    where.purchaseDatetime = { gte: FROM_DATE };
  }

  const groups = await prisma.ticket.groupBy({
    by: ['stripeSessionId'],
    where
  });

  for (const group of groups) {
    const sessionId = group.stripeSessionId!;
    try {
      if (!isStripeCheckoutId(sessionId)) {
        result.skipped++;
        continue;
      }

      const tickets = await prisma.ticket.findMany({
        where: { stripeSessionId: sessionId, deletedAt: null },
        include: { event: true, user: { select: { name: true, email: true, phone: true } } },
        orderBy: { createdAt: 'asc' }
      });
      if (tickets.length === 0) continue;

      const session = await stripe.checkout.sessions.retrieve(sessionId, {
        expand: ['payment_intent', 'line_items']
      });
      if (session.payment_status !== 'paid' || session.status !== 'complete') {
        result.skipped++;
        continue;
      }

      const first = tickets[0];
      const currency = (session.currency ?? 'gbp').toUpperCase();
      const grossPence = session.amount_total ?? 0;
      const { net, fee } = deriveNetAndFee(grossPence, feeConfig);
      const providerPaymentId =
        typeof session.payment_intent === 'string'
          ? session.payment_intent
          : session.payment_intent?.id ?? null;
      const customer = session.customer_details;

      await prisma.$transaction(async (tx) => {
        // Refresh the count inside the transaction so we don't double-create if
        // another process ran concurrently.
        const existing = await tx.payment.count({ where: { providerCheckoutId: sessionId } });
        if (existing > 0) return;

        const payment = await tx.payment.create({
          data: {
            userId: first.userId,
            eventId: first.eventId,
            ticketId: tickets.length === 1 ? tickets[0]!.id : null,
            paymentChannel: 'stripe',
            paymentMethod: session.payment_method_types?.[0] ?? 'card',
            paymentStatus: PaymentStatus.COMPLETED,
            providerCheckoutId: sessionId,
            providerPaymentId,
            currency,
            grossAmount: grossPence / 100,
            processingFee: fee / 100,
            netAmount: net / 100,
            description: `Ticket(s) for ${first.event.title}`,
            notes: 'Reconciled from Stripe Checkout after missing Payment row',
            payerName: customer?.name ?? first.user.name,
            payerEmail: customer?.email ?? first.user.email,
            payerPhone: customer?.phone ?? first.user.phone ?? null,
            payerAddressLine1: customer?.address?.line1 ?? null,
            payerAddressLine2: customer?.address?.line2 ?? null,
            payerCity: customer?.address?.city ?? null,
            payerPostcode: customer?.address?.postal_code ?? null,
            payerCountry: customer?.address?.country ?? null,
            purchasedAt: session.created ? new Date(session.created * 1000) : first.purchaseDatetime,
            sourceType: PaymentSourceType.TICKET,
            sourceId: tickets.length === 1 ? tickets[0]!.id : null,
            metadata: {
              quantity: tickets.length,
              ticketIds: tickets.map((t) => t.id),
              ticketNumbers: tickets.map((t) => t.ticketNumber),
              sessionRef: sessionId,
              reconciledAt: new Date().toISOString()
            } as unknown as Prisma.InputJsonValue
          }
        });

        await tx.ticket.updateMany({
          where: { stripeSessionId: sessionId, deletedAt: null },
          data: { paymentId: payment.id }
        });
      });

      console.log(`  Linked ${tickets.length} ticket(s) to Payment for session ${sessionId}`);
      await syncStripeFeesForSession(prisma, stripe, sessionId);
      result.created++;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      result.errors.push(`orphaned ticket ${sessionId}: ${message}`);
    }
  }
}

/**
 * Scan Stripe for completed checkout sessions that have event_ticket metadata but
 * no matching Ticket rows, then issue the tickets and create the Payment row.
 */
async function reconcileMissingStripeTickets(
  prisma: PrismaClient,
  stripe: Stripe,
  feeConfig: FeeConfig,
  result: ReconcileResult
): Promise<void> {
  const params: Stripe.Checkout.SessionListParams = {
    limit: 100,
    status: 'complete'
  };
  if (FROM_DATE) {
    params.created = { gte: Math.floor(FROM_DATE.getTime() / 1000) };
  }

  let page = await stripe.checkout.sessions.list(params);
  while (true) {
    for (const session of page.data) {
      if (session.metadata?.type !== 'event_ticket') continue;
      const eventId = session.metadata.eventId;
      const userId = session.metadata.userId;
      if (!eventId || !userId) continue;
      if (session.payment_status !== 'paid') continue;

      try {
        const existingCount = await prisma.ticket.count({
          where: { stripeSessionId: session.id, deletedAt: null }
        });
        if (existingCount > 0) continue;

        const event = await prisma.event.findUnique({
          where: { id: eventId, deletedAt: null }
        });
        const user = await prisma.user.findUnique({
          where: { id: userId, deletedAt: null }
        });
        if (!event || !user) {
          result.errors.push(
            `missing session ${session.id}: event or user not found (eventId=${eventId}, userId=${userId})`
          );
          continue;
        }

        const quantity = Number(session.metadata.quantity || '1');
        if (Number.isNaN(quantity) || quantity <= 0) continue;

        const remaining =
          event.maxTickets != null
            ? event.maxTickets -
              (await prisma.ticket.count({
                where: { eventId, status: { not: TicketStatus.CANCELLED }, deletedAt: null }
              }))
            : null;
        if (remaining !== null && quantity > remaining) {
          result.errors.push(
            `missing session ${session.id}: event ${event.title} only has ${remaining} ticket(s) left (needs ${quantity})`
          );
          continue;
        }

        const prefix = event.title.replace(/\s+/g, '-').slice(0, 8).toUpperCase();
        const lastTicket = await prisma.ticket.findFirst({
          where: { eventId, deletedAt: null },
          orderBy: { serialNumber: 'desc' },
          select: { serialNumber: true }
        });
        const startSerial = (lastTicket?.serialNumber ?? 0) + 1;

        const currency = (session.currency ?? 'gbp').toUpperCase();
        const grossPence = session.amount_total ?? 0;
        const { net, fee } = deriveNetAndFee(grossPence, feeConfig);
        const providerPaymentId =
          typeof session.payment_intent === 'string'
            ? session.payment_intent
            : session.payment_intent?.id ?? null;
        const customer = session.customer_details;

        await prisma.$transaction(async (tx) => {
          const existing = await tx.payment.count({ where: { providerCheckoutId: session.id } });
          if (existing > 0) return;

          const createdTickets: { id: string; ticketNumber: string }[] = [];
          for (let i = 0; i < quantity; i++) {
            const serialNumber = startSerial + i;
            const ticketNumber = `${prefix}-${String(serialNumber).padStart(3, '0')}`;
            const ticket = await tx.ticket.create({
              data: {
                eventId,
                userId,
                qrCodeValue: crypto.randomUUID(),
                serialNumber,
                ticketNumber,
                stripeSessionId: session.id,
                status: TicketStatus.VALID
              }
            });
            createdTickets.push({ id: ticket.id, ticketNumber });
          }

          const payment = await tx.payment.create({
            data: {
              userId,
              eventId,
              ticketId: createdTickets[0]?.id ?? null,
              paymentChannel: 'stripe',
              paymentMethod: session.payment_method_types?.[0] ?? 'card',
              paymentStatus: PaymentStatus.COMPLETED,
              providerCheckoutId: session.id,
              providerPaymentId,
              currency,
              grossAmount: grossPence / 100,
              processingFee: fee / 100,
              netAmount: net / 100,
              description: `Ticket(s) for ${event.title}`,
              notes: 'Tickets issued during Stripe reconciliation',
              payerName: customer?.name ?? user.name,
              payerEmail: customer?.email ?? user.email,
              payerPhone: customer?.phone ?? user.phone ?? null,
              payerAddressLine1: customer?.address?.line1 ?? null,
              payerAddressLine2: customer?.address?.line2 ?? null,
              payerCity: customer?.address?.city ?? null,
              payerPostcode: customer?.address?.postal_code ?? null,
              payerCountry: customer?.address?.country ?? null,
              purchasedAt: session.created ? new Date(session.created * 1000) : new Date(),
              sourceType: PaymentSourceType.TICKET,
              sourceId: createdTickets[0]?.id ?? null,
              metadata: {
                quantity,
                ticketIds: createdTickets.map((t) => t.id),
                ticketNumbers: createdTickets.map((t) => t.ticketNumber),
                sessionRef: session.id,
                reconciledAt: new Date().toISOString(),
                autoIssued: true
              } as unknown as Prisma.InputJsonValue
            }
          });

          await tx.ticket.updateMany({
            where: { stripeSessionId: session.id, deletedAt: null },
            data: { paymentId: payment.id }
          });
        });

        console.log(`  Issued ${quantity} ticket(s) for session ${session.id} (${event.title})`);
        await syncStripeFeesForSession(prisma, stripe, session.id);
        result.created++;
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        result.errors.push(`missing session ${session.id}: ${message}`);
      }
    }

    if (!page.has_more || page.data.length === 0) break;
    const lastId = page.data[page.data.length - 1]!.id;
    page = await stripe.checkout.sessions.list({ ...params, starting_after: lastId });
  }
}

async function reconcileMemberships(
  prisma: PrismaClient,
  result: ReconcileResult
): Promise<void> {
  const where: Prisma.MembershipWhereInput = {
    deletedAt: null,
    payments: { none: {} },
    membershipType: { isFree: false, price: { gt: 0 } },
    paymentMethod: { not: null },
    paidAt: { not: null },
    NOT: { paymentMethod: { contains: 'stripe', mode: 'insensitive' } }
  };
  if (FROM_DATE) {
    where.createdAt = { gte: FROM_DATE };
  }

  const memberships = await prisma.membership.findMany({
    where,
    include: {
      membershipType: true,
      user: { select: { id: true, name: true, email: true, phone: true } }
    },
    orderBy: { createdAt: 'asc' }
  });

  for (const m of memberships) {
    try {
      const price = Number(m.membershipType.price);
      const channel = m.paymentMethod?.toLowerCase().includes('stripe')
        ? 'stripe'
        : m.paymentMethod ?? 'manual';
      await createPayment(prisma, {
        userId: m.userId,
        membershipId: m.id,
        paymentChannel: channel,
        paymentMethod: m.paymentMethod ?? null,
        paymentStatus: PaymentStatus.COMPLETED,
        providerPaymentId: m.stripeSubscriptionId ?? null,
        providerCheckoutId: null,
        currency: 'GBP',
        grossAmount: price,
        processingFee: 0,
        netAmount: price,
        description: `Membership: ${m.membershipType.name}`,
        notes: 'Reconciled membership payment',
        payerName: m.user?.name ?? null,
        payerEmail: m.user?.email ?? null,
        payerPhone: m.user?.phone ?? null,
        purchasedAt: m.paidAt ?? m.issuedAt ?? m.createdAt,
        sourceType: PaymentSourceType.MEMBERSHIP,
        sourceId: m.id
      });
      result.created++;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      result.errors.push(`membership ${m.id}: ${message}`);
    }
  }
}

async function reconcileDonations(
  prisma: PrismaClient,
  result: ReconcileResult
): Promise<void> {
  const where: Prisma.DonationWhereInput = {
    deletedAt: null,
    payments: { none: {} }
  };
  if (FROM_DATE) {
    where.donatedAt = { gte: FROM_DATE };
  }

  const donations = await prisma.donation.findMany({
    where,
    include: {
      fundraiser: { select: { title: true } },
      user: { select: { id: true, name: true, email: true, phone: true } }
    },
    orderBy: { donatedAt: 'asc' }
  });

  for (const d of donations) {
    try {
      const channel = d.isOffline ? 'offline' : d.paymentId ? 'stripe' : 'manual';
      const amount = Number(d.amount);
      await createPayment(prisma, {
        userId: d.userId,
        donationId: d.id,
        paymentChannel: channel,
        paymentMethod: d.isOffline ? 'offline' : 'card',
        paymentStatus: PaymentStatus.COMPLETED,
        providerPaymentId: d.paymentId,
        providerCheckoutId: null,
        currency: 'GBP',
        grossAmount: amount,
        processingFee: 0,
        netAmount: amount,
        description: `Donation to ${d.fundraiser.title ?? 'fundraiser'}`,
        notes: d.message ?? 'Reconciled donation payment',
        payerName: d.displayName ?? d.user?.name ?? null,
        payerEmail: d.donorEmail ?? d.user?.email ?? null,
        payerPhone: d.user?.phone ?? null,
        purchasedAt: d.donatedAt,
        sourceType: PaymentSourceType.DONATION,
        sourceId: d.id
      });
      result.created++;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      result.errors.push(`donation ${d.id}: ${message}`);
    }
  }
}

async function reconcileDirectoryPromotions(
  prisma: PrismaClient,
  result: ReconcileResult
): Promise<void> {
  const where: Prisma.BusinessListingWhereInput = {
    deletedAt: null,
    isPromoted: true,
    promotedUntil: { not: null },
    promotionPaidAt: { not: null },
    payments: { none: {} }
  };
  if (FROM_DATE) {
    where.promotionPaidAt = { gte: FROM_DATE };
  }

  const listings = await prisma.businessListing.findMany({
    where,
    include: { owner: { select: { id: true, name: true, email: true, phone: true } } },
    orderBy: { promotionPaidAt: 'asc' }
  });

  const PROMOTION_PRICE = 25; // £25
  for (const listing of listings) {
    try {
      const channel = listing.promotionPaymentMethod === 'offline' ? 'offline' : 'stripe';
      await createPayment(prisma, {
        userId: listing.ownerUserId,
        businessListingId: listing.id,
        paymentChannel: channel,
        paymentMethod: listing.promotionPaymentMethod ?? 'card',
        paymentStatus: PaymentStatus.COMPLETED,
        providerCheckoutId: null,
        providerPaymentId: null,
        currency: 'GBP',
        grossAmount: PROMOTION_PRICE,
        processingFee: 0,
        netAmount: PROMOTION_PRICE,
        description: `Directory promotion: ${listing.businessName}`,
        notes: 'Reconciled directory promotion payment',
        payerName: listing.owner.name,
        payerEmail: listing.owner.email,
        payerPhone: listing.owner.phone ?? null,
        purchasedAt: listing.promotionPaidAt ?? listing.createdAt,
        sourceType: PaymentSourceType.DIRECTORY_PROMOTION,
        sourceId: listing.id
      });
      result.created++;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      result.errors.push(`directory listing ${listing.id}: ${message}`);
    }
  }
}

async function reconcileJobPublishes(
  prisma: PrismaClient,
  result: ReconcileResult
): Promise<void> {
  const where: Prisma.JobAdWhereInput = {
    deletedAt: null,
    isPublished: true,
    publishPaidAt: { not: null },
    payments: { none: {} }
  };
  if (FROM_DATE) {
    where.publishPaidAt = { gte: FROM_DATE };
  }

  const jobs = await prisma.jobAd.findMany({
    where,
    include: {
      businessListing: {
        include: { owner: { select: { id: true, name: true, email: true, phone: true } } }
      }
    },
    orderBy: { publishPaidAt: 'asc' }
  });

  const JOB_PUBLISH_PRICE = 50; // £50
  for (const job of jobs) {
    try {
      if (!job.businessListing) {
        result.errors.push(`job ${job.id}: missing business listing`);
        continue;
      }
      await createPayment(prisma, {
        userId: job.businessListing.ownerUserId,
        jobAdId: job.id,
        paymentChannel: 'manual',
        paymentMethod: 'manual',
        paymentStatus: PaymentStatus.COMPLETED,
        providerCheckoutId: null,
        providerPaymentId: null,
        currency: 'GBP',
        grossAmount: JOB_PUBLISH_PRICE,
        processingFee: 0,
        netAmount: JOB_PUBLISH_PRICE,
        description: `Job publish: ${job.title}`,
        notes: 'Reconciled job publish payment',
        payerName: job.businessListing.owner.name,
        payerEmail: job.businessListing.owner.email,
        payerPhone: job.businessListing.owner.phone ?? null,
        purchasedAt: job.publishPaidAt ?? job.createdAt,
        sourceType: PaymentSourceType.JOB_PUBLISH,
        sourceId: job.id
      });
      result.created++;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      result.errors.push(`job ${job.id}: ${message}`);
    }
  }
}

/**
 * Backfill actual Stripe fees and net settlement for existing Payment rows.
 * This updates every completed Stripe payment that has a providerPaymentId.
 */
async function syncHistoricalStripeFees(
  prisma: PrismaClient,
  stripe: Stripe,
  result: ReconcileResult
): Promise<void> {
  const payments = await prisma.payment.findMany({
    where: {
      deletedAt: null,
      paymentChannel: 'stripe',
      paymentStatus: PaymentStatus.COMPLETED,
      providerPaymentId: { not: null }
    },
    select: { id: true, providerPaymentId: true }
  });

  console.log(`  Syncing Stripe fees for ${payments.length} existing payment(s)...`);

  for (const payment of payments) {
    try {
      const pi = await stripe.paymentIntents.retrieve(payment.providerPaymentId!, {
        expand: ['latest_charge.balance_transaction']
      });
      const latestCharge = pi.latest_charge;
      if (!latestCharge) {
        result.skipped++;
        continue;
      }

      let balanceTransaction: Stripe.BalanceTransaction | string | null | undefined;
      if (typeof latestCharge === 'string') {
        const charge = await stripe.charges.retrieve(latestCharge, {
          expand: ['balance_transaction']
        });
        balanceTransaction = charge.balance_transaction;
      } else {
        balanceTransaction = latestCharge.balance_transaction;
      }

      if (!balanceTransaction) {
        result.skipped++;
        continue;
      }

      const tx =
        typeof balanceTransaction === 'string'
          ? await stripe.balanceTransactions.retrieve(balanceTransaction)
          : balanceTransaction;

      if (DRY_RUN) {
        result.skipped++;
        continue;
      }

      await prisma.payment.update({
        where: { id: payment.id },
        data: {
          processingFee: tx.fee / 100,
          netAmount: tx.net / 100
        }
      });
      result.created++;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      result.errors.push(`payment ${payment.id}: ${message}`);
    }
  }
}

async function main() {
  if (!process.env.DATABASE_URL) {
    console.error('DATABASE_URL is not set. Exiting.');
    process.exit(1);
  }

  console.log(`Starting reconciliation${DRY_RUN ? ' (DRY RUN)' : ''}...`);
  if (FROM_DATE) {
    console.log(`  from: ${FROM_DATE.toISOString().split('T')[0]}`);
  }
  if (ONLY) {
    console.log(`  only: ${ONLY}`);
  }

  const prisma = new PrismaClient();
  const results: Record<string, ReconcileResult> = {};

  try {
    const stripe = await getStripeClient(prisma);
    const feeConfig = await getFeeConfig(prisma);

    if (!ONLY || ONLY === 'tickets') {
      if (stripe) {
        console.log('Scanning Stripe for completed checkout sessions missing tickets...');
        const missing = emptyResult();
        await reconcileMissingStripeTickets(prisma, stripe, feeConfig, missing);
        results.missingTickets = missing;

        console.log('Linking orphaned ticket rows to Payments...');
        const orphaned = emptyResult();
        await reconcileOrphanedTickets(prisma, stripe, feeConfig, orphaned);
        results.orphanedTickets = orphaned;
      } else {
        console.log('Skipping ticket reconciliation: Stripe not configured.');
      }
    }

    if (!ONLY || ONLY === 'memberships') {
      console.log('Reconciling memberships...');
      results.memberships = emptyResult();
      await reconcileMemberships(prisma, results.memberships);
    }

    if (!ONLY || ONLY === 'donations') {
      console.log('Reconciling donations...');
      results.donations = emptyResult();
      await reconcileDonations(prisma, results.donations);
    }

    if (!ONLY || ONLY === 'directory') {
      console.log('Reconciling directory promotions...');
      results.directoryPromotions = emptyResult();
      await reconcileDirectoryPromotions(prisma, results.directoryPromotions);
    }

    if (!ONLY || ONLY === 'jobs') {
      console.log('Reconciling job publishes...');
      results.jobPublishes = emptyResult();
      await reconcileJobPublishes(prisma, results.jobPublishes);
    }

    if (!ONLY || ONLY === 'fees') {
      if (stripe) {
        console.log('Syncing Stripe fees for existing payments...');
        results.stripeFees = emptyResult();
        await syncHistoricalStripeFees(prisma, stripe, results.stripeFees);
      } else {
        console.log('Skipping Stripe fee sync: Stripe not configured.');
      }
    }

    console.log('\nReconciliation complete.');
    console.log(JSON.stringify(results, null, 2));

    const totalErrors = Object.values(results).reduce((sum, r) => sum + r.errors.length, 0);
    if (totalErrors > 0) {
      console.error(`\n${totalErrors} error(s) encountered. Review the output above.`);
      process.exitCode = 1;
    }
  } catch (err) {
    console.error('Fatal error during reconciliation:', err);
    process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
  }
}

main();
