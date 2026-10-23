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
      findMany: jest.fn(),
      count: jest.fn()
    },
    ticket: {
      count: jest.fn()
    }
  };

  const mockEventsService: any = {
    fulfilTicketsForPayment: jest.fn(),
    handleCheckoutCompleted: jest.fn()
  };

  const mockPaymentsService: any = {
    getStripeClient: jest.fn()
  };

  const search = jest.fn<(...args: unknown[]) => Promise<unknown>>();
  const retrieve = jest.fn<(...args: unknown[]) => Promise<unknown>>();

  const payment = (overrides: Record<string, unknown> = {}) => ({
    id: 'pay-1',
    paymentStatus: PaymentStatus.COMPLETED,
    sourceType: PaymentSourceType.TICKET,
    providerCheckoutId: 'pi_123',
    ...overrides
  });

  const ticketIntent = (overrides: Record<string, unknown> = {}) => ({
    id: 'pi_1',
    status: 'succeeded',
    metadata: { type: 'event_ticket', eventId: 'event-1', userId: 'user-1', quantity: '2' },
    ...overrides
  });

  beforeEach(() => {
    jest.clearAllMocks();
    service = new TicketPaymentReconciliationService(mockPrisma, mockEventsService, mockPaymentsService);
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

  describe('reconcileStripeTicketIntents', () => {
    function mockStripe(data: unknown[], nextPage: string | null = null) {
      search.mockResolvedValue({ data, next_page: nextPage });
      mockPaymentsService.getStripeClient.mockResolvedValue({
        paymentIntents: { search, retrieve }
      });
    }

    it('fulfils ticket intents missed by webhooks and confirms', async () => {
      mockStripe([ticketIntent()]);
      retrieve.mockResolvedValue(ticketIntent({ latest_charge: null }));
      mockPrisma.ticket.count.mockResolvedValue(0);
      mockPrisma.payment.count.mockResolvedValue(0);
      mockEventsService.handleCheckoutCompleted.mockResolvedValue([{ id: 'ticket-1' }, { id: 'ticket-2' }]);

      const result = await service.reconcileStripeTicketIntents();

      expect(result).toEqual({ found: 1, fulfilled: 1, skipped: 0 });
      expect(search).toHaveBeenCalledWith(
        expect.objectContaining({
          query: expect.stringContaining("metadata['type']:'event_ticket' AND status:'succeeded' AND created>")
        })
      );
      expect(retrieve).toHaveBeenCalledWith('pi_1', { expand: ['latest_charge'] });
      expect(mockEventsService.handleCheckoutCompleted).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'pi_1',
          object: 'checkout.session',
          metadata: expect.objectContaining({ type: 'event_ticket', eventId: 'event-1', userId: 'user-1' }),
          payment_status: 'paid'
        })
      );
    });

    it('skips intents that already have tickets or a payment row', async () => {
      mockStripe([ticketIntent()]);
      mockPrisma.ticket.count.mockResolvedValue(1);

      const result = await service.reconcileStripeTicketIntents();

      expect(result).toEqual({ found: 1, fulfilled: 0, skipped: 1 });
      expect(retrieve).not.toHaveBeenCalled();
      expect(mockEventsService.handleCheckoutCompleted).not.toHaveBeenCalled();
    });

    it('falls back to the payment row check when no tickets reference the intent', async () => {
      mockStripe([ticketIntent()]);
      mockPrisma.ticket.count.mockResolvedValue(0);
      mockPrisma.payment.count.mockResolvedValue(1);

      const result = await service.reconcileStripeTicketIntents();

      expect(result).toEqual({ found: 1, fulfilled: 0, skipped: 1 });
      expect(mockEventsService.handleCheckoutCompleted).not.toHaveBeenCalled();
    });

    it('skips and warns on intents missing eventId/userId metadata', async () => {
      mockStripe([ticketIntent({ metadata: { type: 'event_ticket' } })]);

      const result = await service.reconcileStripeTicketIntents();

      expect(result).toEqual({ found: 1, fulfilled: 0, skipped: 1 });
      expect(retrieve).not.toHaveBeenCalled();
      expect(mockEventsService.handleCheckoutCompleted).not.toHaveBeenCalled();
    });

    it('tolerates a Stripe API failure and returns zero counts', async () => {
      mockPaymentsService.getStripeClient.mockRejectedValue(new Error('Stripe is not configured'));

      const result = await service.reconcileStripeTicketIntents();

      expect(result).toEqual({ found: 0, fulfilled: 0, skipped: 0 });
      expect(mockEventsService.handleCheckoutCompleted).not.toHaveBeenCalled();
    });

    it('continues with the next intent when one fulfilment throws', async () => {
      mockStripe([ticketIntent(), ticketIntent({ id: 'pi_2' })]);
      retrieve.mockResolvedValue(ticketIntent({ latest_charge: null }));
      mockPrisma.ticket.count.mockResolvedValue(0);
      mockPrisma.payment.count.mockResolvedValue(0);
      mockEventsService.handleCheckoutCompleted
        .mockRejectedValueOnce(new Error('Event sold out'))
        .mockResolvedValueOnce([{ id: 'ticket-3' }]);

      const result = await service.reconcileStripeTicketIntents();

      expect(result).toEqual({ found: 2, fulfilled: 1, skipped: 0 });
      expect(mockEventsService.handleCheckoutCompleted).toHaveBeenCalledTimes(2);
    });
  });
});
