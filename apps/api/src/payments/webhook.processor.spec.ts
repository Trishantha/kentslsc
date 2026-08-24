import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import type Stripe from 'stripe';
import { WebhookProcessor } from './webhook.processor.js';
import type { PaymentsService } from './payments.service.js';
import type { EventsService } from '../events/events.service.js';
import type { MembershipsService } from '../memberships/memberships.service.js';
import type { FundraisingService } from '../fundraising/fundraising.service.js';
import type { DirectoryService } from '../directory/directory.service.js';
import type { WebhookEventService } from './webhook-event.service.js';

describe('WebhookProcessor', () => {
  const paymentsService = {
    syncStripeFeesFromSession: jest.fn()
  } as unknown as jest.Mocked<PaymentsService>;

  const eventsService = {
    handleCheckoutCompleted: jest.fn()
  } as unknown as jest.Mocked<EventsService>;

  const membershipsService = {
    handleCheckoutSessionCompleted: jest.fn(),
    handleSubscriptionUpdated: jest.fn(),
    handleSubscriptionDeleted: jest.fn()
  } as unknown as jest.Mocked<MembershipsService>;

  const fundraisingService = {
    handleCheckoutCompleted: jest.fn()
  } as unknown as jest.Mocked<FundraisingService>;

  const directoryService = {
    handlePromotionCompleted: jest.fn(),
    handleJobPublishCompleted: jest.fn()
  } as unknown as jest.Mocked<DirectoryService>;

  const webhookEvents = {
    markStatus: jest.fn()
  } as unknown as jest.Mocked<WebhookEventService>;

  let processor: WebhookProcessor;

  beforeEach(() => {
    jest.clearAllMocks();
    webhookEvents.markStatus.mockResolvedValue(undefined as any);
    processor = new WebhookProcessor(
      paymentsService as any,
      eventsService as any,
      membershipsService as any,
      fundraisingService as any,
      directoryService as any,
      webhookEvents as any
    );
  });

  function buildJob(type: string, metadata: Record<string, string>): any {
    const session = {
      id: 'cs_test_123',
      metadata,
      customer_email: 'test@example.com',
      amount_total: 2500,
      payment_intent: 'pi_123',
      currency: 'gbp',
      created: Math.floor(Date.now() / 1000)
    } as unknown as Stripe.Checkout.Session;

    return {
      ledgerId: 'ledger-1',
      provider: 'stripe' as const,
      eventType: type,
      payload: {
        id: 'evt_test_1',
        type,
        data: { object: session }
      } as unknown as Stripe.Event
    };
  }

  it('dispatches event ticket sessions', async () => {
    const job = buildJob('checkout.session.completed', {
      type: 'event_ticket',
      eventId: 'event-1',
      userId: 'user-1',
      quantity: '2'
    });
    eventsService.handleCheckoutCompleted.mockResolvedValue([]);

    await processor.process(job);

    expect(eventsService.handleCheckoutCompleted).toHaveBeenCalledWith(job.payload.data.object);
    expect(paymentsService.syncStripeFeesFromSession).toHaveBeenCalledWith(job.payload.data.object);
    expect(webhookEvents.markStatus).toHaveBeenCalledWith('ledger-1', 'processed');
  });

  it('dispatches membership sessions', async () => {
    const job = buildJob('checkout.session.completed', {
      source: 'membership',
      membershipTypeId: 'type-1',
      userId: 'user-1'
    });
    membershipsService.handleCheckoutSessionCompleted.mockResolvedValue({} as any);

    await processor.process(job);

    expect(membershipsService.handleCheckoutSessionCompleted).toHaveBeenCalledWith(job.payload.data.object);
    expect(paymentsService.syncStripeFeesFromSession).toHaveBeenCalledWith(job.payload.data.object);
    expect(webhookEvents.markStatus).toHaveBeenCalledWith('ledger-1', 'processed');
  });

  it('marks the ledger failed when processing throws', async () => {
    const job = buildJob('checkout.session.completed', {
      type: 'event_ticket',
      eventId: 'event-1',
      userId: 'user-1',
      quantity: '2'
    });
    eventsService.handleCheckoutCompleted.mockRejectedValue(new Error('Event sold out'));

    await expect(processor.process(job)).rejects.toThrow('Event sold out');

    expect(webhookEvents.markStatus).toHaveBeenCalledWith('ledger-1', 'failed', 'Event sold out');
  });
});
