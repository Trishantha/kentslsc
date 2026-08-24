import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { generateReceiptNumber, formatReceiptNumber } from './receipt-number.js';

describe('receipt-number', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-08-24T12:00:00Z'));
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('formats a receipt number with the KS prefix', () => {
    expect(formatReceiptNumber(2026, 1)).toBe('KS-2026-000001');
    expect(formatReceiptNumber(2026, 123)).toBe('KS-2026-000123');
    expect(formatReceiptNumber(2026, 1234567)).toBe('KS-2026-1234567');
  });

  it('generates the next receipt number for the current year', async () => {
    const receiptNumberSequence = {
      upsert: jest.fn().mockImplementation(async () => ({ year: 2026, number: 5 }))
    };
    const prisma = {
      $transaction: jest.fn((fn: (tx: any) => Promise<any>) => fn({ receiptNumberSequence }))
    } as any;

    const result = await generateReceiptNumber(prisma);

    expect(receiptNumberSequence.upsert).toHaveBeenCalledWith({
      where: { year: 2026 },
      update: { number: { increment: 1 } },
      create: { year: 2026, number: 1 }
    });
    expect(result).toBe('KS-2026-000005');
  });
});
