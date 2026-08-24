import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import type { Response } from 'express';
import type Stripe from 'stripe';
import { StripeWebhookController } from './stripe-webhook.controller.js';
import type { PaymentsService } from './payments.service.js';
import type { WebhookEventService } from './webhook-event.service.js';
import type { WebhookQueueService } from './webhook-queue.service.js';

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
    syncStripeFeesFromSession: jest.fn()
  } as unknown as jest.Mocked<PaymentsService>;

  const webhookEvents = {
    record: jest.fn(),
    markStatus: jest.fn()
  } as unknown as jest.Mocked<WebhookEventService>;

  const webhookQueue = {
    addWebhookJob: jest.fn()
  } as unknown as jest.Mocked<WebhookQueueService>;

  let controller: StripeWebhookController;

  beforeEach(() => {
    jest.clearAllMocks();
    eventSequence = 0;
    webhookEvents.record.mockResolvedValue({ event: { id: 'ledger-1' } as any, isDuplicate: false });
    webhookEvents.markStatus.mockResolvedValue(undefined as any);
    controller = new StripeWebhookController(
      paymentsService as unknown as PaymentsService,
      webhookEvents as unknown as WebhookEventService,
      webhookQueue as unknown as WebhookQueueService
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
});
