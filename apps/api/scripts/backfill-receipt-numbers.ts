import { PrismaClient } from '@kentslsc/database';
import { generateReceiptNumber, formatReceiptNumber } from '../src/payments/utils/receipt-number.js';
import { setReceiptNumberOnStripePaymentIntent } from '../src/payments/utils/stripe-receipt-metadata.js';

const prisma = new PrismaClient();
const BATCH_SIZE = 100;

async function main() {
  let processed = 0;
  let updated = 0;
  let stripeUpdated = 0;
  let failed = 0;

  while (true) {
    const payments = await prisma.payment.findMany({
      where: { receiptNumber: null, deletedAt: null },
      orderBy: { createdAt: 'asc' },
      take: BATCH_SIZE,
      select: {
        id: true,
        createdAt: true,
        providerPaymentId: true
      }
    });

    if (payments.length === 0) break;

    for (const payment of payments) {
      processed++;
      try {
        const year = payment.createdAt.getFullYear();
        const sequence = await prisma.receiptNumberSequence.upsert({
          where: { year },
          update: { number: { increment: 1 } },
          create: { year, number: 1 }
        });
        const receiptNumber = formatReceiptNumber(year, sequence.number);

        await prisma.payment.update({
          where: { id: payment.id },
          data: { receiptNumber }
        });
        updated++;

        if (payment.providerPaymentId?.startsWith('pi_')) {
          try {
            await setReceiptNumberOnStripePaymentIntent(
              prisma,
              payment.providerPaymentId,
              receiptNumber
            );
            stripeUpdated++;
          } catch (err) {
            console.warn(`Stripe metadata update failed for ${payment.id}:`, err);
          }
        }
      } catch (err) {
        failed++;
        console.error(`Failed to backfill payment ${payment.id}:`, err);
      }
    }

    console.log(`Processed ${processed}, updated ${updated}, Stripe updated ${stripeUpdated}, failed ${failed}`);
  }

  console.log('Backfill complete.');
}

main()
  .catch((err) => {
    console.error('Backfill failed:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
