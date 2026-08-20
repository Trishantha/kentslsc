import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { PaymentReportsService } from './reports.service.js';
import { PaymentStatus, PaymentSourceType } from '@kentslsc/database';

describe('PaymentReportsService', () => {
  let service: PaymentReportsService;
  const prisma = {
    payment: {
      findMany: jest.fn(),
      count: jest.fn(),
      aggregate: jest.fn()
    }
  } as any;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new PaymentReportsService(prisma);
  });

  function buildPayment(overrides: any = {}) {
    return {
      id: 'pay-1',
      purchasedAt: new Date('2026-08-15T10:00:00Z'),
      createdAt: new Date('2026-08-15T10:00:00Z'),
      payerName: 'Jane Doe',
      payerEmail: 'jane@example.com',
      payerPhone: '01234567890',
      payerAddressLine1: '1 The Street',
      payerAddressLine2: null,
      payerCity: 'London',
      payerPostcode: 'SW1A 1AA',
      payerCountry: 'GB',
      notes: 'Test payment',
      currency: 'GBP',
      grossAmount: 25,
      processingFee: 1,
      netAmount: 24,
      refundedAmount: null,
      paymentChannel: 'stripe',
      providerPaymentId: 'pi_123',
      paymentMethod: 'card',
      paymentStatus: PaymentStatus.COMPLETED,
      sourceType: PaymentSourceType.TICKET,
      sourceId: 't-1',
      description: 'Ticket(s) for Summer Event',
      event: { id: 'event-1', title: 'Summer Event' },
      ticket: { id: 't-1', ticketNumber: 'SUMMER-001' },
      membership: null,
      donation: null,
      businessListing: null,
      jobAd: null,
      user: { id: 'user-1', name: 'Jane Doe', email: 'jane@example.com', phone: '01234567890' },
      ...overrides
    };
  }

  it('returns a paginated revenue report with aggregates', async () => {
    prisma.payment.findMany.mockResolvedValue([buildPayment()]);
    prisma.payment.count.mockResolvedValue(1);
    prisma.payment.aggregate.mockResolvedValue({
      _sum: { grossAmount: 25, processingFee: 1, netAmount: 24, refundedAmount: 0 }
    });

    const report = await service.getRevenueReport({ page: 1, limit: 25 });

    expect(report.total).toBe(1);
    expect(report.rows).toHaveLength(1);
    expect(report.rows[0]).toMatchObject({
      name: 'Jane Doe',
      email: 'jane@example.com',
      amount: 25,
      fees: 1,
      netPayment: 24,
      paymentChannel: 'stripe',
      paymentId: 'pi_123',
      paymentStatus: PaymentStatus.COMPLETED,
      sourceType: PaymentSourceType.TICKET
    });
    expect(report.aggregates).toEqual({ gross: 25, fees: 1, net: 24, refunded: 0 });
    expect(prisma.payment.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ skip: 0, take: 25 })
    );
  });

  it('applies date, source type and channel filters', async () => {
    prisma.payment.findMany.mockResolvedValue([]);
    prisma.payment.count.mockResolvedValue(0);
    prisma.payment.aggregate.mockResolvedValue({
      _sum: { grossAmount: 0, processingFee: 0, netAmount: 0, refundedAmount: 0 }
    });

    await service.getRevenueReport({
      from: new Date('2026-08-01'),
      to: new Date('2026-08-31'),
      sourceType: PaymentSourceType.MEMBERSHIP,
      channel: 'stripe',
      status: PaymentStatus.COMPLETED,
      search: 'jane'
    });

    const call = prisma.payment.findMany.mock.calls[0][0];
    expect(call.where.purchasedAt).toEqual({ gte: new Date('2026-08-01'), lte: new Date('2026-08-31') });
    expect(call.where.sourceType).toBe(PaymentSourceType.MEMBERSHIP);
    expect(call.where.paymentChannel).toEqual({ equals: 'stripe', mode: 'insensitive' });
    expect(call.where.paymentStatus).toBe(PaymentStatus.COMPLETED);
    expect(call.where.OR).toBeDefined();
  });

  it('exports all matching rows without pagination', async () => {
    prisma.payment.findMany.mockResolvedValue([buildPayment(), buildPayment({ id: 'pay-2' })]);

    const rows = await service.getAllForExport({ sourceType: PaymentSourceType.DONATION });

    expect(rows).toHaveLength(2);
    expect(prisma.payment.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ sourceType: PaymentSourceType.DONATION })
      })
    );
  });
});
