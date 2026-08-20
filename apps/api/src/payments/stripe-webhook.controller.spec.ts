import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import type { Response } from 'express';
import type Stripe from 'stripe';
import { StripeWebhookController } from './stripe-webhook.controller.js';
import type { PaymentsService } from './payments.service.js';
import type { EventsService } from '../events/events.service.js';
import type { MembershipsService } from '../memberships/memberships.service.js';
import type { FundraisingService } from '../fundraising/fundraising.service.js';
import type { DirectoryService } from '../directory/directory.service.js';
import type { WebhookEventService } from './webhook-event.service.js';

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
    constructEvent: jest.fn()
  } as unknown as jest.Mocked<PaymentsService>;

  const eventsService = {
    handleCheckoutCompleted: jest.fn()
  } as unknown as jest.Mocked<EventsService>;

  const membershipsService = {
    handleCheckoutSessionCompleted: jest.fn()
  } as unknown as jest.Mocked<MembershipsService>;

  const fundraisingService = {
    handleCheckoutCompleted: jest.fn()
  } as unknown as jest.Mocked<FundraisingService>;

  const directoryService = {
    handlePromotionCompleted: jest.fn(),
    handleJobPublishCompleted: jest.fn()
  } as unknown as jest.Mocked<DirectoryService>;

  const webhookEvents = {
    record: jest.fn(),
    markStatus: jest.fn()
  } as unknown as jest.Mocked<WebhookEventService>;

  let controller: StripeWebhookController;

  beforeEach(() => {
    jest.clearAllMocks();
    eventSequence = 0;
    webhookEvents.record.mockResolvedValue({ event: { id: 'ledger-1' } as any, isDuplicate: false });
    webhookEvents.markStatus.mockResolvedValue(undefined as any);
    controller = new StripeWebhookController(
      paymentsService as unknown as PaymentsService,
      eventsService as unknown as EventsService,
      membershipsService as unknown as MembershipsService,
      fundraisingService as unknown as FundraisingService,
      directoryService as unknown as DirectoryService,
      webhookEvents as unknown as WebhookEventService
    );
  });

  it('dispatches membership checkout sessions', async () => {
    const session = buildSession({ source: 'membership', membershipTypeId: 'type-1', userId: 'user-1', fullName: 'Test User' });
    paymentsService.constructEvent.mockResolvedValue(buildEvent(session));
    membershipsService.handleCheckoutSessionCompleted.mockResolvedValue({ received: true, membershipId: 'mem-1' });

    const res = mockResponse();
    await controller.handleWebhook('sig', Buffer.from('payload'), res as unknown as Response);

    expect(paymentsService.constructEvent).toHaveBeenCalledWith(Buffer.from('payload'), 'sig');
    expect(membershipsService.handleCheckoutSessionCompleted).toHaveBeenCalledWith(session);
    expect(res.json).toHaveBeenCalledWith({ received: true });
  });

  it('dispatches event ticket checkout sessions', async () => {
    const session = buildSession({ type: 'event_ticket', eventId: 'event-1', userId: 'user-1', quantity: '2' });
    paymentsService.constructEvent.mockResolvedValue(buildEvent(session));
    eventsService.handleCheckoutCompleted.mockResolvedValue([]);

    const res = mockResponse();
    await controller.handleWebhook('sig', Buffer.from('payload'), res as unknown as Response);

    expect(eventsService.handleCheckoutCompleted).toHaveBeenCalledWith(session);
    expect(res.json).toHaveBeenCalledWith({ received: true });
  });

  it('dispatches donation checkout sessions', async () => {
    const session = buildSession({ type: 'donation', fundraiserId: 'fund-1', userId: 'user-1' });
    paymentsService.constructEvent.mockResolvedValue(buildEvent(session));
    fundraisingService.handleCheckoutCompleted.mockResolvedValue(undefined);

    const res = mockResponse();
    await controller.handleWebhook('sig', Buffer.from('payload'), res as unknown as Response);

    expect(fundraisingService.handleCheckoutCompleted).toHaveBeenCalledWith(session);
    expect(res.json).toHaveBeenCalledWith({ received: true });
  });

  it('dispatches directory promotion checkout sessions', async () => {
    const metadata = { type: 'directory_promotion', businessListingId: 'biz-1' };
    const session = buildSession(metadata);
    paymentsService.constructEvent.mockResolvedValue(buildEvent(session));
    directoryService.handlePromotionCompleted.mockResolvedValue({ received: true });

    const res = mockResponse();
    await controller.handleWebhook('sig', Buffer.from('payload'), res as unknown as Response);

    expect(directoryService.handlePromotionCompleted).toHaveBeenCalledWith(
      metadata,
      'stripe',
      expect.objectContaining({
        providerCheckoutId: session.id,
        providerPaymentId: 'pi_123',
        amountPence: 2500,
        currency: 'gbp',
        payerEmail: 'test@example.com',
        payerName: null,
        payerPhone: null,
        purchasedAt: expect.any(Date)
      })
    );
    expect(res.json).toHaveBeenCalledWith({ received: true });
  });

  it('dispatches job publish checkout sessions', async () => {
    const metadata = { type: 'job_publish', jobAdId: 'job-1' };
    const session = buildSession(metadata);
    paymentsService.constructEvent.mockResolvedValue(buildEvent(session));
    directoryService.handleJobPublishCompleted.mockResolvedValue({ received: true });

    const res = mockResponse();
    await controller.handleWebhook('sig', Buffer.from('payload'), res as unknown as Response);

    expect(directoryService.handleJobPublishCompleted).toHaveBeenCalledWith(
      metadata,
      expect.objectContaining({
        providerCheckoutId: session.id,
        providerPaymentId: 'pi_123',
        amountPence: 2500,
        currency: 'gbp',
        payerEmail: 'test@example.com',
        payerName: null,
        payerPhone: null,
        purchasedAt: expect.any(Date)
      })
    );
    expect(res.json).toHaveBeenCalledWith({ received: true });
  });

  it('ignores checkout sessions with unknown metadata', async () => {
    const session = buildSession({ type: 'unknown' });
    paymentsService.constructEvent.mockResolvedValue(buildEvent(session));

    const res = mockResponse();
    await controller.handleWebhook('sig', Buffer.from('payload'), res as unknown as Response);

    expect(membershipsService.handleCheckoutSessionCompleted).not.toHaveBeenCalled();
    expect(eventsService.handleCheckoutCompleted).not.toHaveBeenCalled();
    expect(fundraisingService.handleCheckoutCompleted).not.toHaveBeenCalled();
    expect(directoryService.handlePromotionCompleted).not.toHaveBeenCalled();
    expect(directoryService.handleJobPublishCompleted).not.toHaveBeenCalled();
    expect(res.json).toHaveBeenCalledWith({ received: true });
  });

  it('returns 400 when signature verification fails', async () => {
    paymentsService.constructEvent.mockRejectedValue(new Error('Invalid signature'));

    const res = mockResponse();
    await controller.handleWebhook('bad-sig', Buffer.from('payload'), res as unknown as Response);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.send).toHaveBeenCalledWith('Webhook error: Invalid signature');
    expect(webhookEvents.record).not.toHaveBeenCalled();
  });

  it('records duplicate Stripe events and returns success without reprocessing', async () => {
    const session = buildSession({ source: 'membership', membershipTypeId: 'type-1', userId: 'user-1', fullName: 'Test User' });
    const event = buildEvent(session);
    paymentsService.constructEvent.mockResolvedValue(event);
    webhookEvents.record.mockResolvedValue({ event: { id: 'ledger-1' } as any, isDuplicate: true });

    const res = mockResponse();
    await controller.handleWebhook('sig', Buffer.from('payload'), res as unknown as Response);

    expect(webhookEvents.record).toHaveBeenCalledWith(
      expect.objectContaining({
        provider: 'stripe',
        eventType: 'checkout.session.completed',
        externalId: event.id
      })
    );
    expect(membershipsService.handleCheckoutSessionCompleted).not.toHaveBeenCalled();
    expect(res.json).toHaveBeenCalledWith({ received: true, duplicate: true });
  });

  it('records a failed webhook and returns 400 when downstream processing fails', async () => {
    const session = buildSession({ source: 'membership', membershipTypeId: 'type-1', userId: 'user-1', fullName: 'Test User' });
    paymentsService.constructEvent.mockResolvedValue(buildEvent(session));
    membershipsService.handleCheckoutSessionCompleted.mockRejectedValue(new Error('Membership type not found'));

    const res = mockResponse();
    await controller.handleWebhook('sig', Buffer.from('payload'), res as unknown as Response);

    expect(webhookEvents.markStatus).toHaveBeenCalledWith(
      'ledger-1',
      'failed',
      'Membership type not found'
    );
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.send).toHaveBeenCalledWith('Webhook error: Membership type not found');
  });
});
