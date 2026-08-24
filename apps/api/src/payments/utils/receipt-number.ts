import { PrismaClient } from '@kentslsc/database';

const RECEIPT_PREFIX = 'KS';

export function formatReceiptNumber(year: number, number: number): string {
  return `${RECEIPT_PREFIX}-${year}-${String(number).padStart(6, '0')}`;
}

/**
 * Atomically reserve the next receipt number for the current calendar year.
 * Uses a dedicated sequence table so concurrent checkouts cannot collide.
 */
export async function generateReceiptNumber(prisma: PrismaClient): Promise<string> {
  const year = new Date().getFullYear();

  const nextNumber = await prisma.$transaction(async (tx) => {
    const sequence = await tx.receiptNumberSequence.upsert({
      where: { year },
      update: { number: { increment: 1 } },
      create: { year, number: 1 }
    });
    return sequence.number;
  });

  return formatReceiptNumber(year, nextNumber);
}
