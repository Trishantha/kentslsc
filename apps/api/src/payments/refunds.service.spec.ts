import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { RefundsService } from './refunds.service.js';
import { PaymentStatus } from '@kentslsc/database';
import { NotFoundException, BadRequestException } from '@nestjs/common';

jest.mock('gocardless-nodejs', () => ({
  GoCardlessClient: jest.fn(),
  Environments: { Live: 'live', Sandbox: 'sandbox' }
}));

function buildPayment(overrides: any = {}) {
  return {
    id: 'pay-1',
    paymentStatus: PaymentStatus.COMPLETED,
    paymentChannel: 'stripe',
    providerPaymentId: 'pi_123',
    providerCheckoutId: 'cs_test_123',
    currency: 'GBP',
    grossAmount: 10,
    refundedAmount: null,
    notes: null,
    payerEmail: 'payer@example.com',
    event: { title: 'Summer Event' },
    ...overrides
  };
}

describe('RefundsService', () => {
  let service: RefundsService;
  const prisma = {
    payment: {
      findUnique: jest.fn(),
      update: jest.fn()
    }
  } as any;

  const paymentsService = {
    refundStripePaymentIntent: jest.fn(),
    refundPayPalCapture: jest.fn(),
    getStripePaymentIntentIdFromSession: jest.fn(),
    cancelTicketsForRefund: jest.fn(async () => 0)
  } as any;

  const emailService = {
    sendTicketRefundConfirmation: jest.fn().mockImplementation(async () => undefined)
  } as any;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new RefundsService(prisma, paymentsService, emailService);
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

  it('refunds a Stripe payment in full and cancels the linked tickets', async () => {
    const payment = buildPayment();
    prisma.payment.findUnique.mockResolvedValue(payment);
    paymentsService.refundStripePaymentIntent.mockResolvedValue({ providerRefundId: 're_123' });
    paymentsService.cancelTicketsForRefund.mockResolvedValue(2);
    prisma.payment.update.mockResolvedValue({ ...payment, paymentStatus: PaymentStatus.REFUNDED });

    const result = await service.refundPayment('pay-1', { reason: 'Requested by customer' });

    expect(paymentsService.refundStripePaymentIntent).toHaveBeenCalledWith('pi_123', 1000, 'Requested by customer');
    expect(paymentsService.cancelTicketsForRefund).toHaveBeenCalledWith('pay-1', 'cs_test_123');
    expect(prisma.payment.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'pay-1' },
        data: expect.objectContaining({
          paymentStatus: PaymentStatus.REFUNDED,
          notes: expect.stringContaining('Tickets cancelled: 2')
        })
      })
    );
    expect(result.isFullyRefunded).toBe(true);
    expect(result.providerRefundId).toBe('re_123');
    expect(emailService.sendTicketRefundConfirmation).toHaveBeenCalledWith(
      'payer@example.com',
      'Summer Event',
      10,
      'GBP',
      true
    );
  });

  it('records a partial refund, leaves payment partially refunded and still cancels tickets', async () => {
    prisma.payment.findUnique.mockResolvedValue(buildPayment());
    paymentsService.refundStripePaymentIntent.mockResolvedValue({ providerRefundId: 're_partial' });
    paymentsService.cancelTicketsForRefund.mockResolvedValue(1);
    prisma.payment.update.mockResolvedValue({
      ...buildPayment(),
      paymentStatus: PaymentStatus.PARTIALLY_REFUNDED,
      refundedAmount: 5
    });

    const result = await service.refundPayment('pay-1', { amount: 5 });

    expect(result.isFullyRefunded).toBe(false);
    expect(result.refundedAmount).toBe(5);
    expect(paymentsService.refundStripePaymentIntent).toHaveBeenCalledWith('pi_123', 500, undefined);
    expect(paymentsService.cancelTicketsForRefund).toHaveBeenCalledWith('pay-1', 'cs_test_123');
    expect(emailService.sendTicketRefundConfirmation).toHaveBeenCalledWith(
      'payer@example.com',
      'Summer Event',
      5,
      'GBP',
      false
    );
  });

  it('does not send a refund email when no tickets are linked to the payment', async () => {
    prisma.payment.findUnique.mockResolvedValue(buildPayment());
    paymentsService.refundStripePaymentIntent.mockResolvedValue({ providerRefundId: 're_123' });
    paymentsService.cancelTicketsForRefund.mockResolvedValue(0);
    prisma.payment.update.mockResolvedValue({ ...buildPayment(), paymentStatus: PaymentStatus.REFUNDED });

    await service.refundPayment('pay-1', {});

    expect(emailService.sendTicketRefundConfirmation).not.toHaveBeenCalled();
  });

  it('resolves a Stripe payment intent from the checkout session when providerPaymentId is missing', async () => {
    prisma.payment.findUnique.mockResolvedValue(
      buildPayment({ providerPaymentId: null, providerCheckoutId: 'cs_test_123' })
    );
    paymentsService.getStripePaymentIntentIdFromSession.mockResolvedValue('pi_from_session');
    paymentsService.refundStripePaymentIntent.mockResolvedValue({ providerRefundId: 're_123' });
    prisma.payment.update.mockResolvedValue({
      ...buildPayment(),
      paymentStatus: PaymentStatus.REFUNDED,
      refundedAmount: 10
    });

    const result = await service.refundPayment('pay-1', { reason: 'Requested by customer' });

    expect(paymentsService.getStripePaymentIntentIdFromSession).toHaveBeenCalledWith('cs_test_123');
    expect(paymentsService.refundStripePaymentIntent).toHaveBeenCalledWith(
      'pi_from_session',
      1000,
      'Requested by customer'
    );
    expect(result.providerRefundId).toBe('re_123');
  });

  it('records a manual refund for Stripe payments with no resolvable gateway ID', async () => {
    prisma.payment.findUnique.mockResolvedValue(
      buildPayment({ providerPaymentId: null, providerCheckoutId: 'cs_test_123' })
    );
    paymentsService.getStripePaymentIntentIdFromSession.mockResolvedValue(null);
    prisma.payment.update.mockResolvedValue({
      ...buildPayment(),
      paymentStatus: PaymentStatus.REFUNDED,
      refundedAmount: 10
    });

    const result = await service.refundPayment('pay-1', { reason: 'No gateway record' });

    expect(paymentsService.refundStripePaymentIntent).not.toHaveBeenCalled();
    expect(result.providerRefundId).toBe('manual');
  });

  it('records a manual refund for Stripe subscription payments (sub_ IDs)', async () => {
    prisma.payment.findUnique.mockResolvedValue(
      buildPayment({ providerPaymentId: 'sub_123', providerCheckoutId: null })
    );
    prisma.payment.update.mockResolvedValue({
      ...buildPayment(),
      paymentStatus: PaymentStatus.REFUNDED,
      refundedAmount: 10
    });

    const result = await service.refundPayment('pay-1', { reason: 'Subscription cancellation' });

    expect(paymentsService.getStripePaymentIntentIdFromSession).not.toHaveBeenCalled();
    expect(paymentsService.refundStripePaymentIntent).not.toHaveBeenCalled();
    expect(result.providerRefundId).toBe('manual');
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
