import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import type { Response } from 'express';
import { GoCardlessWebhookController } from './gocardless-webhook.controller.js';
import type { GoCardlessService } from './gocardless.service.js';
import type { WebhookEventService } from './webhook-event.service.js';
import type { WebhookQueueService } from './webhook-queue.service.js';
import type { WebhookProcessor } from './webhook.processor.js';
import type { GoCardlessWebhookEvent } from './gocardless-webhook.types.js';

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

let eventSequence = 0;

function buildEvent(overrides: Partial<GoCardlessWebhookEvent> = {}): GoCardlessWebhookEvent {
  eventSequence += 1;
  return {
    id: `EV0${eventSequence}`,
    action: 'confirmed',
    resource_type: 'payments',
    links: { payment: `PM${eventSequence}` },
    body: { payments: { id: `PM${eventSequence}`, amount: '2500', currency: 'GBP' } },
    ...overrides
  };
}

function buildBatch(events: GoCardlessWebhookEvent[]): Buffer {
  return Buffer.from(JSON.stringify({ events }));
}

describe('GoCardlessWebhookController', () => {
  const goCardlessService = {
    getWebhookSecret: jest.fn(),
    verifyWebhookSignature: jest.fn()
  } as unknown as jest.Mocked<GoCardlessService>;

  const webhookEvents = {
    record: jest.fn(),
    markStatus: jest.fn(),
    listFailed: jest.fn()
  } as unknown as jest.Mocked<WebhookEventService>;

  const webhookQueue = {
    addWebhookJob: jest.fn()
  } as unknown as jest.Mocked<WebhookQueueService>;

  const webhookProcessor = {
    process: jest.fn()
  } as unknown as jest.Mocked<WebhookProcessor>;

  let controller: GoCardlessWebhookController;

  beforeEach(() => {
    jest.clearAllMocks();
    eventSequence = 0;
    goCardlessService.getWebhookSecret.mockResolvedValue('whsec_test');
    goCardlessService.verifyWebhookSignature.mockReturnValue(true);
    webhookEvents.record.mockResolvedValue({ event: { id: 'ledger-1' } as any, isDuplicate: false });
    webhookEvents.markStatus.mockResolvedValue(undefined as any);
    webhookQueue.addWebhookJob.mockResolvedValue(undefined as any);
    controller = new GoCardlessWebhookController(
      goCardlessService as unknown as GoCardlessService,
      webhookEvents as unknown as WebhookEventService,
      webhookQueue as unknown as WebhookQueueService
    );
  });

  it('records and enqueues each event in a batch', async () => {
    const first = buildEvent();
    const second = buildEvent({ action: 'failed' });
    let ledgerSequence = 0;
    webhookEvents.record.mockImplementation(() => {
      ledgerSequence += 1;
      return Promise.resolve({ event: { id: `ledger-${ledgerSequence}` } as any, isDuplicate: false });
    });

    const res = mockResponse();
    await controller.handleWebhook('valid-sig', buildBatch([first, second]), res as unknown as Response);

    expect(goCardlessService.verifyWebhookSignature).toHaveBeenCalledWith(
      expect.any(Buffer),
      'valid-sig',
      'whsec_test'
    );
    expect(webhookEvents.record).toHaveBeenCalledTimes(2);
    expect(webhookEvents.record).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        provider: 'gocardless',
        eventType: 'payments.confirmed',
        externalId: first.id,
        status: 'received'
      })
    );
    expect(webhookEvents.record).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        provider: 'gocardless',
        eventType: 'payments.failed',
        externalId: second.id
      })
    );
    expect(webhookQueue.addWebhookJob).toHaveBeenCalledTimes(2);
    expect(webhookQueue.addWebhookJob).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ ledgerId: 'ledger-1', provider: 'gocardless', eventType: 'payments.confirmed', payload: first })
    );
    expect(webhookQueue.addWebhookJob).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ ledgerId: 'ledger-2', provider: 'gocardless', eventType: 'payments.failed', payload: second })
    );
    expect(res.json).toHaveBeenCalledWith({ received: true, events: expect.any(Array) });
  });

  it('dedupes an event id that was already recorded', async () => {
    const event = buildEvent();
    webhookEvents.record.mockResolvedValue({ event: { id: 'ledger-1' } as any, isDuplicate: true });

    const res = mockResponse();
    await controller.handleWebhook('valid-sig', buildBatch([event]), res as unknown as Response);

    expect(webhookQueue.addWebhookJob).not.toHaveBeenCalled();
    expect(res.json).toHaveBeenCalledWith({
      received: true,
      events: [{ id: event.id, duplicate: true }]
    });
  });

  it('re-queues a duplicate event that previously failed', async () => {
    const event = buildEvent();
    webhookEvents.record.mockResolvedValue({
      event: { id: 'ledger-1', status: 'failed' } as any,
      isDuplicate: true
    });

    const res = mockResponse();
    await controller.handleWebhook('valid-sig', buildBatch([event]), res as unknown as Response);

    expect(webhookQueue.addWebhookJob).toHaveBeenCalledWith(
      expect.objectContaining({ ledgerId: 'ledger-1', provider: 'gocardless', payload: event })
    );
    expect(res.json).toHaveBeenCalledWith({
      received: true,
      events: [{ id: event.id, received: true }]
    });
  });

  it('reports 500 when re-enqueueing a failed duplicate fails', async () => {
    const event = buildEvent();
    webhookEvents.record.mockResolvedValue({
      event: { id: 'ledger-1', status: 'failed' } as any,
      isDuplicate: true
    });
    webhookQueue.addWebhookJob.mockRejectedValue(new Error('Redis unreachable'));

    const res = mockResponse();
    await controller.handleWebhook('valid-sig', buildBatch([event]), res as unknown as Response);

    expect(webhookEvents.markStatus).toHaveBeenCalledWith('ledger-1', 'failed', 'Redis unreachable');
    expect(res.status).toHaveBeenCalledWith(500);
  });

  describe('replayFailedWebhooks', () => {
    it('re-queues failed events with payloads and resets their status', async () => {
      webhookEvents.listFailed.mockResolvedValue([
        {
          id: 'ledger-1',
          provider: 'gocardless',
          eventType: 'payments.confirmed',
          payload: { id: 'EV1', action: 'confirmed', resource_type: 'payments' }
        },
        { id: 'ledger-2', provider: 'stripe', eventType: 'checkout.session.completed', payload: null }
      ] as any[]);

      const result = await controller.replayFailedWebhooks();

      expect(webhookQueue.addWebhookJob).toHaveBeenCalledTimes(1);
      expect(webhookQueue.addWebhookJob).toHaveBeenCalledWith(
        expect.objectContaining({
          ledgerId: 'ledger-1',
          provider: 'gocardless',
          eventType: 'payments.confirmed',
          payload: { id: 'EV1', action: 'confirmed', resource_type: 'payments' }
        })
      );
      expect(webhookEvents.markStatus).toHaveBeenCalledWith('ledger-1', 'received');
      expect(result).toEqual({ requeued: 1, skipped: 1, skippedIds: ['ledger-2'] });
    });

    it('keeps the failed status when re-enqueueing throws', async () => {
      webhookEvents.listFailed.mockResolvedValue([
        { id: 'ledger-1', provider: 'gocardless', eventType: 'payments.confirmed', payload: { id: 'EV1' } }
      ] as any[]);
      webhookQueue.addWebhookJob.mockRejectedValue(new Error('Redis unreachable'));

      const result = await controller.replayFailedWebhooks();

      expect(webhookEvents.markStatus).toHaveBeenCalledWith('ledger-1', 'failed', 'Redis unreachable');
      expect(result.requeued).toBe(0);
    });
  });

  it('returns 400 when the signature is invalid', async () => {
    goCardlessService.verifyWebhookSignature.mockReturnValue(false);

    const res = mockResponse();
    await controller.handleWebhook('bad-sig', buildBatch([buildEvent()]), res as unknown as Response);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.send).toHaveBeenCalledWith('Webhook error: signature verification failed');
    expect(webhookEvents.record).not.toHaveBeenCalled();
  });

  it('returns 400 when no webhook signature header is present', async () => {
    const res = mockResponse();
    await controller.handleWebhook(undefined as unknown as string, buildBatch([buildEvent()]), res as unknown as Response);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(webhookEvents.record).not.toHaveBeenCalled();
  });

  it('returns 400 when no webhook secret is configured', async () => {
    goCardlessService.getWebhookSecret.mockResolvedValue(undefined);

    const res = mockResponse();
    await controller.handleWebhook('sig', buildBatch([buildEvent()]), res as unknown as Response);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(webhookEvents.record).not.toHaveBeenCalled();
  });

  it('falls back to synchronous processing when the queue processes inline', async () => {
    const event = buildEvent();
    // WebhookQueueService falls back to WebhookProcessor.process when Redis is
    // unavailable; simulate that by running the processor inside addWebhookJob.
    webhookQueue.addWebhookJob.mockImplementation(async (job: any) => {
      await webhookProcessor.process(job);
    });
    webhookProcessor.process.mockResolvedValue(undefined);

    const res = mockResponse();
    await controller.handleWebhook('valid-sig', buildBatch([event]), res as unknown as Response);

    expect(webhookProcessor.process).toHaveBeenCalledWith(
      expect.objectContaining({ provider: 'gocardless', eventType: 'payments.confirmed', payload: event })
    );
    expect(res.json).toHaveBeenCalledWith({ received: true, events: [{ id: event.id, received: true }] });
  });

  it('returns 500 and marks the ledger failed when enqueueing fails', async () => {
    const event = buildEvent();
    webhookQueue.addWebhookJob.mockRejectedValue(new Error('Redis unreachable'));

    const res = mockResponse();
    await controller.handleWebhook('valid-sig', buildBatch([event]), res as unknown as Response);

    expect(webhookEvents.markStatus).toHaveBeenCalledWith('ledger-1', 'failed', 'Redis unreachable');
    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.send).toHaveBeenCalledWith('Webhook error: Redis unreachable');
  });
});
