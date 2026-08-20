import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { RefundsService } from './refunds.service.js';
import { PaymentStatus, TicketStatus } from '@kentslsc/database';
import { NotFoundException, BadRequestException } from '@nestjs/common';

function buildPayment(overrides: any = {}) {
  return {
    id: 'pay-1',
    paymentStatus: PaymentStatus.COMPLETED,
    paymentChannel: 'stripe',
    providerPaymentId: 'pi_123',
    currency: 'GBP',
    grossAmount: 10,
    refundedAmount: null,
    notes: null,
    ticket: null,
    ...overrides
  };
}

describe('RefundsService', () => {
  let service: RefundsService;
  const prisma = {
    payment: {
      findUnique: jest.fn(),
      update: jest.fn()
    },
    ticket: {
      update: jest.fn()
    }
  } as any;

  const paymentsService = {
    refundStripePaymentIntent: jest.fn(),
    refundPayPalCapture: jest.fn()
  } as any;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new RefundsService(prisma, paymentsService);
  });

  it('throws NotFoundException when payment does not exist', async () => {
    prisma.payment.findUnique.mockResolvedValue(null);
    await expect(service.refundPayment('missing', {})).rejects.toBeInstanceOf(NotFoundException);
  });

  it('throws when payment is not completed', async () => {
    prisma.payment.findUnique.mockResolvedValue(buildPayment({ paymentStatus: PaymentStatus.PENDING }));
    await expect(service.refundPayment('pay-1', {})).rejects.toBeInstanceOf(BadRequestException);
  });

  it('throws when payment is already fully refunded', async () => {
    prisma.payment.findUnique.mockResolvedValue(buildPayment({ paymentStatus: PaymentStatus.REFUNDED }));
    await expect(service.refundPayment('pay-1', {})).rejects.toBeInstanceOf(BadRequestException);
  });

  it('throws when refund amount exceeds refundable balance', async () => {
    prisma.payment.findUnique.mockResolvedValue(buildPayment({ refundedAmount: 5 }));
    await expect(service.refundPayment('pay-1', { amount: 6 })).rejects.toBeInstanceOf(BadRequestException);
  });

  it('refunds a Stripe payment in full and cancels the linked ticket', async () => {
    const payment = buildPayment({ ticket: { id: 't-1' } });
    prisma.payment.findUnique.mockResolvedValue(payment);
    paymentsService.refundStripePaymentIntent.mockResolvedValue({ providerRefundId: 're_123' });
    prisma.payment.update.mockResolvedValue({ ...payment, paymentStatus: PaymentStatus.REFUNDED });

    const result = await service.refundPayment('pay-1', { reason: 'Requested by customer' });

    expect(paymentsService.refundStripePaymentIntent).toHaveBeenCalledWith('pi_123', 1000, 'Requested by customer');
    expect(prisma.payment.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'pay-1' },
        data: expect.objectContaining({ paymentStatus: PaymentStatus.REFUNDED })
      })
    );
    expect(prisma.ticket.update).toHaveBeenCalledWith({
      where: { id: 't-1' },
      data: { status: TicketStatus.CANCELLED }
    });
    expect(result.isFullyRefunded).toBe(true);
    expect(result.providerRefundId).toBe('re_123');
  });

  it('records a partial refund and leaves payment status as partially refunded', async () => {
    prisma.payment.findUnique.mockResolvedValue(buildPayment());
    paymentsService.refundStripePaymentIntent.mockResolvedValue({ providerRefundId: 're_partial' });
    prisma.payment.update.mockResolvedValue({
      ...buildPayment(),
      paymentStatus: PaymentStatus.PARTIALLY_REFUNDED,
      refundedAmount: 5
    });

    const result = await service.refundPayment('pay-1', { amount: 5 });

    expect(result.isFullyRefunded).toBe(false);
    expect(result.refundedAmount).toBe(5);
    expect(paymentsService.refundStripePaymentIntent).toHaveBeenCalledWith('pi_123', 500, undefined);
  });

  it('records a manual refund for offline/manual/free payments', async () => {
    prisma.payment.findUnique.mockResolvedValue(buildPayment({ paymentChannel: 'manual', providerPaymentId: null }));
    prisma.payment.update.mockResolvedValue({
      ...buildPayment(),
      paymentStatus: PaymentStatus.REFUNDED,
      refundedAmount: 10
    });

    const result = await service.refundPayment('pay-1', { reason: 'Goodwill' });

    expect(paymentsService.refundStripePaymentIntent).not.toHaveBeenCalled();
    expect(paymentsService.refundPayPalCapture).not.toHaveBeenCalled();
    expect(result.providerRefundId).toBe('manual');
    expect(result.isFullyRefunded).toBe(true);
  });

  it('refunds a PayPal capture', async () => {
    prisma.payment.findUnique.mockResolvedValue(
      buildPayment({ paymentChannel: 'paypal', providerPaymentId: 'CAPTURE-1' })
    );
    paymentsService.refundPayPalCapture.mockResolvedValue({ providerRefundId: 'REFUND-1' });
    prisma.payment.update.mockResolvedValue({
      ...buildPayment({ paymentChannel: 'paypal' }),
      paymentStatus: PaymentStatus.REFUNDED,
      refundedAmount: 10
    });

    const result = await service.refundPayment('pay-1', { amount: 10 });

    expect(paymentsService.refundPayPalCapture).toHaveBeenCalledWith('CAPTURE-1', 1000, 'GBP');
    expect(result.providerRefundId).toBe('REFUND-1');
  });
});
