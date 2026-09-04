import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import type Stripe from 'stripe';
import { WebhookProcessor } from './webhook.processor.js';
import type { PaymentsService } from './payments.service.js';
import type { EventsService } from '../events/events.service.js';
import type { MembershipsService } from '../memberships/memberships.service.js';
import type { FundraisingService } from '../fundraising/fundraising.service.js';
import type { DirectoryService } from '../directory/directory.service.js';
import type { WebhookEventService } from './webhook-event.service.js';
import type { GoCardlessService } from './gocardless.service.js';

jest.mock('gocardless-nodejs', () => ({
  GoCardlessClient: jest.fn(),
  Environments: { Live: 'live', Sandbox: 'sandbox' }
}));

describe('WebhookProcessor', () => {
  const paymentsService = {
    syncStripeFeesFromSession: jest.fn(),
    recordGoCardlessRefund: jest.fn()
  } as unknown as jest.Mocked<PaymentsService>;

  const eventsService = {
    handleCheckoutCompleted: jest.fn(),
    handleGoCardlessPaymentCompleted: jest.fn()
  } as unknown as jest.Mocked<EventsService>;

  const membershipsService = {
    handleCheckoutSessionCompleted: jest.fn(),
    handleSubscriptionUpdated: jest.fn(),
    handleSubscriptionDeleted: jest.fn(),
    handleGoCardlessPaymentCompleted: jest.fn(),
    handleGoCardlessPaymentFailed: jest.fn(),
    handleGoCardlessMandateActive: jest.fn(),
    handleGoCardlessMandateCancelled: jest.fn(),
    handleGoCardlessSubscriptionPaymentCreated: jest.fn(),
    handleGoCardlessSubscriptionStatus: jest.fn(),
    handleGoCardlessInstalmentScheduleCreated: jest.fn(),
    handleGoCardlessInstalmentPayment: jest.fn(),
    handleGoCardlessInstalmentScheduleFinished: jest.fn()
  } as unknown as jest.Mocked<MembershipsService>;

  const fundraisingService = {
    handleCheckoutCompleted: jest.fn(),
    handleGoCardlessPaymentCompleted: jest.fn()
  } as unknown as jest.Mocked<FundraisingService>;

  const directoryService = {
    handlePromotionCompleted: jest.fn(),
    handleJobPublishCompleted: jest.fn(),
    handleGoCardlessPaymentCompleted: jest.fn()
  } as unknown as jest.Mocked<DirectoryService>;

  const webhookEvents = {
    markStatus: jest.fn()
  } as unknown as jest.Mocked<WebhookEventService>;

  const goCardlessService = {
    getPayment: jest.fn(),
    getBillingRequest: jest.fn(),
    recordGoCardlessRefund: jest.fn()
  } as unknown as jest.Mocked<GoCardlessService>;

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
      webhookEvents as any,
      goCardlessService as any
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

  describe('GoCardless events', () => {
    function buildGoCardlessJob(event: {
      action: string;
      resourceType: string;
      payment?: Record<string, unknown>;
      metadata?: Record<string, string>;
      billingRequest?: string;
      links?: Record<string, string>;
    }): any {
      const payment = event.payment ?? { id: 'PM123', amount: '1000', currency: 'GBP' };
      return {
        ledgerId: 'ledger-1',
        provider: 'gocardless' as const,
        eventType: `${event.resourceType}.${event.action}`,
        payload: {
          id: 'EV123',
          action: event.action,
          resource_type: event.resourceType,
          links: event.links ?? { payment: (payment as any).id ?? 'PM123' },
          body: {
            payments: {
              ...payment,
              ...(event.billingRequest ? { links: { billing_request: event.billingRequest } } : {})
            }
          }
        }
      };
    }

    it('fulfils membership payments using metadata from the billing request', async () => {
      const job = buildGoCardlessJob({
        action: 'confirmed',
        resourceType: 'payments',
        billingRequest: 'BR123',
        payment: { id: 'PM123', amount: '5000', currency: 'GBP' } // no metadata on the payment body
      });
      goCardlessService.getBillingRequest.mockResolvedValue({
        id: 'BR123',
        status: 'fulfilled',
        metadata: { source: 'membership', membershipId: 'membership-1', userId: 'user-1' }
      } as any);
      membershipsService.handleGoCardlessPaymentCompleted.mockResolvedValue({} as any);

      await processor.process(job);

      expect(goCardlessService.getBillingRequest).toHaveBeenCalledWith('BR123');
      expect(membershipsService.handleGoCardlessPaymentCompleted).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'PM123' }),
        expect.objectContaining({ source: 'membership', membershipId: 'membership-1' })
      );
      expect(webhookEvents.markStatus).toHaveBeenCalledWith('ledger-1', 'processed');
    });

    it.each([
      ['event_ticket', 'eventsService'],
      ['donation', 'fundraisingService'],
      ['directory_promotion', 'directoryService'],
      ['job_publish', 'directoryService']
    ] as const)('routes %s payments to the right domain handler', async (type, serviceName) => {
      const job = buildGoCardlessJob({
        action: 'confirmed',
        resourceType: 'payments',
        payment: { id: 'PM123', amount: '2500', currency: 'GBP', metadata: { type, eventId: 'event-1' } }
      });
      eventsService.handleGoCardlessPaymentCompleted.mockResolvedValue([] as any);
      fundraisingService.handleGoCardlessPaymentCompleted.mockResolvedValue({} as any);
      directoryService.handleGoCardlessPaymentCompleted.mockResolvedValue({} as any);

      await processor.process(job);

      const service =
        serviceName === 'eventsService'
          ? eventsService
          : serviceName === 'fundraisingService'
            ? fundraisingService
            : directoryService;
      const expectedMetadata = expect.objectContaining({ type });
      if (serviceName === 'directoryService') {
        expect(service.handleGoCardlessPaymentCompleted).toHaveBeenCalledWith(
          expect.objectContaining({ id: 'PM123' }),
          expectedMetadata,
          type
        );
      } else {
        expect(service.handleGoCardlessPaymentCompleted).toHaveBeenCalledWith(
          expect.objectContaining({ id: 'PM123' }),
          expectedMetadata
        );
      }
      expect(webhookEvents.markStatus).toHaveBeenCalledWith('ledger-1', 'processed');
    });

    it('treats payments.paid_out as a no-op for fulfilment', async () => {
      const job = buildGoCardlessJob({
        action: 'paid_out',
        resourceType: 'payments',
        payment: { id: 'PM123', metadata: { source: 'membership' } }
      });

      await processor.process(job);

      expect(membershipsService.handleGoCardlessPaymentCompleted).not.toHaveBeenCalled();
      expect(webhookEvents.markStatus).toHaveBeenCalledWith('ledger-1', 'processed');
    });

    it('waits for payment confirmation before fulfilling subscription collections', async () => {
      const job = buildGoCardlessJob({
        action: 'payment_created',
        resourceType: 'subscriptions',
        payment: { id: 'PM123', links: { subscription: 'SB123' } }
      });

      await processor.process(job);

      expect(membershipsService.handleGoCardlessPaymentCompleted).not.toHaveBeenCalled();
      expect(membershipsService.handleGoCardlessSubscriptionPaymentCreated).not.toHaveBeenCalled();
      expect(webhookEvents.markStatus).toHaveBeenCalledWith('ledger-1', 'processed');
    });

    it('fulfils confirmed subscription payments without checkout metadata', async () => {
      const job = buildGoCardlessJob({
        action: 'confirmed',
        resourceType: 'payments',
        payment: { id: 'PM123', links: { subscription: 'SB123' } }
      });
      membershipsService.handleGoCardlessPaymentCompleted.mockResolvedValue({} as any);

      await processor.process(job);

      expect(membershipsService.handleGoCardlessPaymentCompleted).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'PM123', links: { subscription: 'SB123' } }),
        {}
      );
      expect(webhookEvents.markStatus).toHaveBeenCalledWith('ledger-1', 'processed');
    });

    it('marks failed payments and notifies the memberships service', async () => {
      const job = buildGoCardlessJob({
        action: 'failed',
        resourceType: 'payments',
        payment: { id: 'PM123', status: 'failed' }
      });
      membershipsService.handleGoCardlessPaymentFailed.mockResolvedValue({} as any);

      await processor.process(job);

      expect(membershipsService.handleGoCardlessPaymentFailed).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'PM123' })
      );
      expect(webhookEvents.markStatus).toHaveBeenCalledWith('ledger-1', 'processed');
    });

    it('dispatches mandate and subscription lifecycle events', async () => {
      membershipsService.handleGoCardlessMandateActive.mockResolvedValue({} as any);
      membershipsService.handleGoCardlessSubscriptionStatus.mockResolvedValue({} as any);

      await processor.process({
        ledgerId: 'ledger-1',
        provider: 'gocardless',
        eventType: 'mandates.active',
        payload: {
          id: 'EV124',
          action: 'active',
          resource_type: 'mandates',
          body: { mandates: { id: 'MD123', status: 'active' } }
        }
      });
      expect(membershipsService.handleGoCardlessMandateActive).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'MD123' })
      );

      await processor.process({
        ledgerId: 'ledger-1',
        provider: 'gocardless',
        eventType: 'subscriptions.cancelled',
        payload: {
          id: 'EV125',
          action: 'cancelled',
          resource_type: 'subscriptions',
          body: { subscriptions: { id: 'SB123', status: 'cancelled' } }
        }
      });
      expect(membershipsService.handleGoCardlessSubscriptionStatus).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'SB123' }),
        'cancelled'
      );
    });

    it('marks the ledger ignored for unknown event types', async () => {
      await processor.process({
        ledgerId: 'ledger-1',
        provider: 'gocardless',
        eventType: 'payouts.paid',
        payload: {
          id: 'EV126',
          action: 'paid',
          resource_type: 'payouts',
          body: {}
        }
      });

      expect(webhookEvents.markStatus).toHaveBeenCalledWith('ledger-1', 'ignored');
    });

    it('marks the ledger ignored when a confirmed payment has no fulfilment metadata', async () => {
      goCardlessService.getBillingRequest.mockResolvedValue({ id: 'BR123', metadata: {} } as any);
      const job = buildGoCardlessJob({
        action: 'confirmed',
        resourceType: 'payments',
        billingRequest: 'BR123'
      });

      await processor.process(job);

      expect(membershipsService.handleGoCardlessPaymentCompleted).not.toHaveBeenCalled();
      expect(eventsService.handleGoCardlessPaymentCompleted).not.toHaveBeenCalled();
      expect(webhookEvents.markStatus).toHaveBeenCalledWith('ledger-1', 'ignored');
    });

    it('applies refunds to the payment ledger', async () => {
      paymentsService.recordGoCardlessRefund.mockResolvedValue({} as any);

      await processor.process({
        ledgerId: 'ledger-1',
        provider: 'gocardless',
        eventType: 'refunds.created',
        payload: {
          id: 'EV127',
          action: 'created',
          resource_type: 'refunds',
          body: { refunds: { id: 'RF123', amount: '1000', links: { payment: 'PM123' } } }
        }
      });

      expect(paymentsService.recordGoCardlessRefund).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'RF123', links: { payment: 'PM123' } })
      );
      expect(webhookEvents.markStatus).toHaveBeenCalledWith('ledger-1', 'processed');
    });
  });
});
