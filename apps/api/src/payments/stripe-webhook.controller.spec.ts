import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import type { Response } from 'express';
import type Stripe from 'stripe';
import { StripeWebhookController } from './stripe-webhook.controller.js';
import type { PaymentsService } from './payments.service.js';
import type { WebhookEventService } from './webhook-event.service.js';
import type { WebhookQueueService } from './webhook-queue.service.js';
import type { WebhookProcessor } from './webhook.processor.js';
import type { GoCardlessService } from './gocardless.service.js';

jest.mock('gocardless-nodejs', () => ({
  GoCardlessClient: jest.fn(),
  Environments: { Live: 'live', Sandbox: 'sandbox' }
}));

type MockResponse = {
  json: jest.Mock;
  status: jest.Mock;
  send: jest.Mock;
};

function mockResponse(): MockResponse {
  const res = {
    json: jest.fn(),
    status: jest.fn(),
    send: jest.fn()
  };
  res.status.mockReturnValue(res);
  res.json.mockReturnValue(res);
  res.send.mockReturnValue(res);
  return res as MockResponse;
}

function buildSession(metadata: Record<string, string>): Stripe.Checkout.Session {
  return {
    id: 'cs_test_123',
    metadata,
    customer_email: 'test@example.com',
    amount_total: 2500,
    payment_intent: 'pi_123'
  } as Stripe.Checkout.Session;
}

let eventSequence = 0;

function buildEvent(session: Stripe.Checkout.Session): Stripe.Event {
  eventSequence += 1;
  return {
    id: `evt_test_${eventSequence}`,
    type: 'checkout.session.completed',
    data: { object: session }
  } as unknown as Stripe.Event;
}

describe('StripeWebhookController', () => {
  const paymentsService = {
    constructEvent: jest.fn(),
    syncStripeFeesFromSession: jest.fn(),
    getFullCheckoutSession: jest.fn(),
    getPaymentByProviderCheckoutId: jest.fn()
  } as unknown as jest.Mocked<PaymentsService>;

  const webhookEvents = {
    record: jest.fn(),
    markStatus: jest.fn()
  } as unknown as jest.Mocked<WebhookEventService>;

  const webhookQueue = {
    addWebhookJob: jest.fn()
  } as unknown as jest.Mocked<WebhookQueueService>;

  const webhookProcessor = {
    process: jest.fn()
  } as unknown as jest.Mocked<WebhookProcessor>;

  const goCardlessService = {
    getBillingRequest: jest.fn()
  } as unknown as jest.Mocked<GoCardlessService>;

  let controller: StripeWebhookController;

  beforeEach(() => {
    jest.clearAllMocks();
    eventSequence = 0;
    webhookEvents.record.mockResolvedValue({ event: { id: 'ledger-1' } as any, isDuplicate: false });
    webhookEvents.markStatus.mockResolvedValue(undefined as any);
    controller = new StripeWebhookController(
      paymentsService as unknown as PaymentsService,
      webhookEvents as unknown as WebhookEventService,
      webhookQueue as unknown as WebhookQueueService,
      webhookProcessor as unknown as WebhookProcessor,
      goCardlessService as unknown as GoCardlessService
    );
  });

  it('records the event and enqueues it for asynchronous processing', async () => {
    const session = buildSession({ type: 'event_ticket', eventId: 'event-1', userId: 'user-1', quantity: '2' });
    const event = buildEvent(session);
    paymentsService.constructEvent.mockResolvedValue(event);

    const res = mockResponse();
    await controller.handleWebhook('sig', Buffer.from('payload'), res as unknown as Response);

    expect(paymentsService.constructEvent).toHaveBeenCalledWith(Buffer.from('payload'), 'sig');
    expect(webhookEvents.record).toHaveBeenCalledWith(
      expect.objectContaining({
        provider: 'stripe',
        eventType: 'checkout.session.completed',
        externalId: event.id,
        status: 'received'
      })
    );
    expect(webhookQueue.addWebhookJob).toHaveBeenCalledWith(
      expect.objectContaining({
        ledgerId: 'ledger-1',
        provider: 'stripe',
        eventType: 'checkout.session.completed',
        payload: event
      })
    );
    expect(res.json).toHaveBeenCalledWith({ received: true });
  });

  it('does not reprocess duplicate Stripe events', async () => {
    const session = buildSession({ source: 'membership', membershipTypeId: 'type-1', userId: 'user-1', fullName: 'Test User' });
    const event = buildEvent(session);
    paymentsService.constructEvent.mockResolvedValue(event);
    webhookEvents.record.mockResolvedValue({ event: { id: 'ledger-1' } as any, isDuplicate: true });

    const res = mockResponse();
    await controller.handleWebhook('sig', Buffer.from('payload'), res as unknown as Response);

    expect(webhookQueue.addWebhookJob).not.toHaveBeenCalled();
    expect(res.json).toHaveBeenCalledWith({ received: true, duplicate: true });
  });

  it('returns 400 when signature verification fails', async () => {
    paymentsService.constructEvent.mockRejectedValue(new Error('Invalid signature'));

    const res = mockResponse();
    await controller.handleWebhook('bad-sig', Buffer.from('payload'), res as unknown as Response);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.send).toHaveBeenCalledWith('Webhook error: Invalid signature');
    expect(webhookEvents.record).not.toHaveBeenCalled();
  });

  it('returns 500 and marks the ledger failed when enqueueing fails', async () => {
    const session = buildSession({ source: 'membership', membershipTypeId: 'type-1', userId: 'user-1', fullName: 'Test User' });
    const event = buildEvent(session);
    paymentsService.constructEvent.mockResolvedValue(event);
    webhookQueue.addWebhookJob.mockRejectedValue(new Error('Redis unreachable'));

    const res = mockResponse();
    await controller.handleWebhook('sig', Buffer.from('payload'), res as unknown as Response);

    expect(webhookEvents.markStatus).toHaveBeenCalledWith(
      'ledger-1',
      'failed',
      'Redis unreachable'
    );
    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.send).toHaveBeenCalledWith('Webhook error: Redis unreachable');
  });

  describe('confirmSession', () => {
    function buildStripeSession(overrides?: Partial<Stripe.Checkout.Session>): Stripe.Checkout.Session {
      return {
        id: 'cs_test_123',
        status: 'complete',
        payment_status: 'paid',
        metadata: { source: 'membership', membershipTypeId: 'type-1', userId: 'user-1', fullName: 'Test User' },
        customer_email: 'test@example.com',
        amount_total: 2500,
        currency: 'gbp',
        payment_intent: 'pi_123',
        ...overrides
      } as unknown as Stripe.Checkout.Session;
    }

    it('retrieves the session, records a synthetic event and processes it', async () => {
      const session = buildStripeSession();
      paymentsService.getFullCheckoutSession.mockResolvedValue(session);
      webhookProcessor.process.mockResolvedValue(undefined);

      const result = await controller.confirmSession({ sessionId: 'cs_test_123', provider: 'stripe' });

      expect(paymentsService.getFullCheckoutSession).toHaveBeenCalledWith('cs_test_123');
      expect(webhookEvents.record).toHaveBeenCalledWith(
        expect.objectContaining({
          provider: 'stripe',
          eventType: 'checkout.session.completed',
          externalId: 'confirm:cs_test_123',
          status: 'received'
        })
      );
      expect(webhookProcessor.process).toHaveBeenCalledWith(
        expect.objectContaining({
          ledgerId: 'ledger-1',
          provider: 'stripe',
          eventType: 'checkout.session.completed'
        })
      );
      expect(result).toEqual({ received: true });
    });

    it('returns duplicate when the session has already been confirmed', async () => {
      const session = buildStripeSession();
      paymentsService.getFullCheckoutSession.mockResolvedValue(session);
      webhookEvents.record.mockResolvedValue({
        event: { id: 'ledger-1', status: 'processed' } as any,
        isDuplicate: true
      });

      const result = await controller.confirmSession({ sessionId: 'cs_test_123', provider: 'stripe' });

      expect(webhookProcessor.process).not.toHaveBeenCalled();
      expect(result).toEqual({ received: true, duplicate: true });
    });

    it('reprocesses a previously failed confirmation instead of skipping it', async () => {
      const session = buildStripeSession();
      paymentsService.getFullCheckoutSession.mockResolvedValue(session);
      webhookEvents.record.mockResolvedValue({
        event: { id: 'ledger-1', status: 'failed' } as any,
        isDuplicate: true
      });
      webhookProcessor.process.mockResolvedValue(undefined);

      const result = await controller.confirmSession({ sessionId: 'cs_test_123', provider: 'stripe' });

      expect(webhookProcessor.process).toHaveBeenCalledWith(
        expect.objectContaining({ ledgerId: 'ledger-1', eventType: 'checkout.session.completed' })
      );
      expect(result).toEqual({ received: true });
    });

    it('reprocesses a confirmation whose ledger entry never reached processed', async () => {
      const session = buildStripeSession();
      paymentsService.getFullCheckoutSession.mockResolvedValue(session);
      webhookEvents.record.mockResolvedValue({
        event: { id: 'ledger-1', status: 'received' } as any,
        isDuplicate: true
      });
      webhookProcessor.process.mockResolvedValue(undefined);

      const result = await controller.confirmSession({ sessionId: 'cs_test_123', provider: 'stripe' });

      expect(webhookProcessor.process).toHaveBeenCalled();
      expect(result).toEqual({ received: true });
    });

    it('throws when the checkout session is not complete', async () => {
      const session = buildStripeSession({ status: 'open', payment_status: 'unpaid' });
      paymentsService.getFullCheckoutSession.mockResolvedValue(session);

      await expect(controller.confirmSession({ sessionId: 'cs_test_123', provider: 'stripe' })).rejects.toThrow(
        'Checkout session is not complete'
      );
      expect(webhookEvents.record).not.toHaveBeenCalled();
      expect(webhookProcessor.process).not.toHaveBeenCalled();
    });

    it('throws when provider is paypal', async () => {
      await expect(controller.confirmSession({ sessionId: 'cs_test_123', provider: 'paypal' })).rejects.toThrow(
        'PayPal confirmation is not yet supported'
      );
    });

    it('throws when sessionId or provider is missing', async () => {
      await expect(controller.confirmSession({ sessionId: '', provider: 'stripe' })).rejects.toThrow(
        'sessionId and provider are required'
      );
      await expect(controller.confirmSession({ sessionId: 'cs_test_123', provider: '' as any })).rejects.toThrow(
        'sessionId and provider are required'
      );
    });

    it('confirms a fulfilled GoCardless billing request via a synthetic event', async () => {
      goCardlessService.getBillingRequest.mockResolvedValue({
        id: 'BR123',
        status: 'fulfilled',
        metadata: { source: 'membership', membershipId: 'membership-1', userId: 'user-1' },
        links: { payment_request_payment: 'PM123', mandate_request_mandate: 'MD123' }
      } as any);
      paymentsService.getPaymentByProviderCheckoutId.mockResolvedValue(null);
      webhookProcessor.process.mockResolvedValue(undefined);

      const result = await controller.confirmSession({ sessionId: 'BR123', provider: 'gocardless' });

      expect(goCardlessService.getBillingRequest).toHaveBeenCalledWith('BR123');
      expect(webhookEvents.record).toHaveBeenCalledWith(
        expect.objectContaining({
          provider: 'gocardless',
          eventType: 'payments.confirmed',
          externalId: 'confirm:BR123',
          status: 'received'
        })
      );
      expect(webhookProcessor.process).toHaveBeenCalledWith(
        expect.objectContaining({
          ledgerId: 'ledger-1',
          provider: 'gocardless',
          eventType: 'payments.confirmed',
          payload: expect.objectContaining({
            resource_type: 'payments',
            action: 'confirmed',
            body: expect.objectContaining({
              payments: expect.objectContaining({
                id: 'PM123',
                metadata: expect.objectContaining({ source: 'membership' })
              })
            })
          })
        })
      );
      expect(result).toEqual({ received: true });
    });

    it('returns duplicate when the GoCardless billing request was already confirmed', async () => {
      goCardlessService.getBillingRequest.mockResolvedValue({
        id: 'BR123',
        status: 'fulfilled',
        metadata: { source: 'membership' },
        links: { payment_request_payment: 'PM123' }
      } as any);
      webhookEvents.record.mockResolvedValue({
        event: { id: 'ledger-1', status: 'processed' } as any,
        isDuplicate: true
      });

      const result = await controller.confirmSession({ sessionId: 'BR123', provider: 'gocardless' });

      expect(webhookProcessor.process).not.toHaveBeenCalled();
      expect(result).toEqual({ received: true, duplicate: true });
    });

    it('throws when the GoCardless billing request is not fulfilled', async () => {
      goCardlessService.getBillingRequest.mockResolvedValue({
        id: 'BR123',
        status: 'pending',
        metadata: {}
      } as any);

      await expect(controller.confirmSession({ sessionId: 'BR123', provider: 'gocardless' })).rejects.toThrow(
        'Billing request is not fulfilled'
      );
      expect(webhookEvents.record).not.toHaveBeenCalled();
      expect(webhookProcessor.process).not.toHaveBeenCalled();
    });
  });
});
