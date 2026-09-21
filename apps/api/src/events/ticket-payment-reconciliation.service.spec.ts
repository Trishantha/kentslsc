import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { TicketPaymentReconciliationService } from './ticket-payment-reconciliation.service.js';
import { PaymentSourceType, PaymentStatus } from '@kentslsc/database';

jest.mock('gocardless-nodejs', () => ({
  GoCardlessClient: jest.fn(),
  Environments: { Live: 'live', Sandbox: 'sandbox' }
}));

describe('TicketPaymentReconciliationService', () => {
  let service: TicketPaymentReconciliationService;

  const mockPrisma: any = {
    payment: {
      findMany: jest.fn()
    },
    ticket: {
      count: jest.fn()
    }
  };

  const mockEventsService: any = {
    fulfilTicketsForPayment: jest.fn()
  };

  const payment = (overrides: Record<string, unknown> = {}) => ({
    id: 'pay-1',
    paymentStatus: PaymentStatus.COMPLETED,
    sourceType: PaymentSourceType.TICKET,
    providerCheckoutId: 'pi_123',
    ...overrides
  });

  beforeEach(() => {
    jest.clearAllMocks();
    service = new TicketPaymentReconciliationService(mockPrisma, mockEventsService);
  });

  it('issues tickets for completed ticket payments that have none', async () => {
    mockPrisma.payment.findMany.mockResolvedValue([payment()]);
    mockPrisma.ticket.count.mockResolvedValue(0);
    mockEventsService.fulfilTicketsForPayment.mockResolvedValue([{ id: 'ticket-1' }]);

    const result = await service.reconcileUnfulfilledTicketPayments();

    expect(result).toEqual({ checked: 1, issued: 1 });
    expect(mockPrisma.payment.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          paymentStatus: PaymentStatus.COMPLETED,
          sourceType: PaymentSourceType.TICKET,
          deletedAt: null
        })
      })
    );
    expect(mockPrisma.ticket.count).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          OR: [{ paymentId: 'pay-1' }, { stripeSessionId: 'pi_123' }]
        })
      })
    );
    expect(mockEventsService.fulfilTicketsForPayment).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'pay-1' })
    );
  });

  it('skips payments that already have tickets', async () => {
    mockPrisma.payment.findMany.mockResolvedValue([payment()]);
    mockPrisma.ticket.count.mockResolvedValue(2);

    const result = await service.reconcileUnfulfilledTicketPayments();

    expect(result).toEqual({ checked: 1, issued: 0 });
    expect(mockEventsService.fulfilTicketsForPayment).not.toHaveBeenCalled();
  });

  it('continues with the next payment when fulfilment throws', async () => {
    const second = payment({ id: 'pay-2', providerCheckoutId: null });
    mockPrisma.payment.findMany.mockResolvedValue([payment(), second]);
    mockPrisma.ticket.count.mockResolvedValue(0);
    mockEventsService.fulfilTicketsForPayment
      .mockRejectedValueOnce(new Error('Not enough tickets remaining'))
      .mockResolvedValueOnce([{ id: 'ticket-2' }]);

    const result = await service.reconcileUnfulfilledTicketPayments();

    expect(result).toEqual({ checked: 2, issued: 1 });
    expect(mockEventsService.fulfilTicketsForPayment).toHaveBeenCalledTimes(2);
  });
});
