import { jest, describe, it, expect, beforeEach } from '@jest/globals';
import { PrismaService } from '../core/prisma/prisma.service.js';
import { WebhookEventService } from './webhook-event.service.js';

describe('WebhookEventService', () => {
  let service: WebhookEventService;
  let prisma: jest.Mocked<PrismaService>;

  beforeEach(() => {
    prisma = {
      webhookEvent: {
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn()
      }
    } as unknown as jest.Mocked<PrismaService>;
    service = new WebhookEventService(prisma);
  });

  it('creates a new webhook event record', async () => {
    prisma.webhookEvent.findUnique.mockResolvedValue(null);
    prisma.webhookEvent.create.mockResolvedValue({
      id: 'evt-1',
      provider: 'stripe',
      eventType: 'checkout.session.completed',
      externalId: 'evt_external_1',
      status: 'received'
    } as any);

    const result = await service.record({
      provider: 'stripe',
      eventType: 'checkout.session.completed',
      externalId: 'evt_external_1',
      payload: Buffer.from('payload')
    });

    expect(result.isDuplicate).toBe(false);
    expect(prisma.webhookEvent.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          provider: 'stripe',
          eventType: 'checkout.session.completed',
          externalId: 'evt_external_1',
          status: 'received'
        })
      })
    );
  });

  it('returns existing record without creating duplicate for same external id', async () => {
    const existing = {
      id: 'evt-1',
      provider: 'stripe',
      eventType: 'checkout.session.completed',
      externalId: 'evt_external_1',
      status: 'processed'
    } as any;
    prisma.webhookEvent.findUnique.mockResolvedValue(existing);

    const result = await service.record({
      provider: 'stripe',
      eventType: 'checkout.session.completed',
      externalId: 'evt_external_1',
      payload: Buffer.from('different-payload')
    });

    expect(result.isDuplicate).toBe(true);
    expect(result.event).toBe(existing);
    expect(prisma.webhookEvent.create).not.toHaveBeenCalled();
  });

  it('creates a record with null external id when not provided', async () => {
    prisma.webhookEvent.create.mockResolvedValue({
      id: 'evt-2',
      provider: 'stripe',
      eventType: 'invoice.payment_failed',
      externalId: null
    } as any);

    const result = await service.record({
      provider: 'stripe',
      eventType: 'invoice.payment_failed',
      payload: Buffer.from('payload')
    });

    expect(result.isDuplicate).toBe(false);
    expect(prisma.webhookEvent.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ externalId: null })
      })
    );
  });

  it('marks an event as processed', async () => {
    prisma.webhookEvent.update.mockResolvedValue({ id: 'evt-1', status: 'processed' } as any);

    await service.markStatus('evt-1', 'processed');

    expect(prisma.webhookEvent.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'evt-1' },
        data: expect.objectContaining({
          status: 'processed',
          processedAt: expect.any(Date),
          errorMessage: null
        })
      })
    );
  });

  it('marks an event as failed with an error message', async () => {
    prisma.webhookEvent.update.mockResolvedValue({ id: 'evt-1', status: 'failed' } as any);

    await service.markStatus('evt-1', 'failed', 'Membership type not found');

    expect(prisma.webhookEvent.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'evt-1' },
        data: expect.objectContaining({
          status: 'failed',
          errorMessage: 'Membership type not found'
        })
      })
    );
  });
});
