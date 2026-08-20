import { Injectable } from '@nestjs/common';
import { createHash } from 'crypto';
import { PrismaService } from '../core/prisma/prisma.service.js';

export type WebhookStatus = 'received' | 'processed' | 'ignored' | 'failed';

interface RecordWebhookInput {
  provider: string;
  eventType: string;
  externalId?: string | null;
  payload: Buffer | string;
  status?: WebhookStatus;
  errorMessage?: string | null;
}

@Injectable()
export class WebhookEventService {
  constructor(private readonly prisma: PrismaService) {}

  private hashPayload(payload: Buffer | string): string {
    return createHash('sha256').update(payload).digest('hex');
  }

  /**
   * Record a webhook event and return its id. If an event with the same
   * provider and external id already exists, return the existing row instead of
   * creating a duplicate. This makes the ledger idempotent across retries.
   */
  async record(input: RecordWebhookInput) {
    const payloadHash = this.hashPayload(input.payload);

    if (input.externalId) {
      const existing = await this.prisma.webhookEvent.findUnique({
        where: {
          provider_externalId: {
            provider: input.provider,
            externalId: input.externalId
          }
        }
      });
      if (existing) {
        return { event: existing, isDuplicate: true };
      }
    }

    const event = await this.prisma.webhookEvent.create({
      data: {
        provider: input.provider,
        eventType: input.eventType,
        externalId: input.externalId ?? null,
        payloadHash,
        status: input.status ?? 'received',
        errorMessage: input.errorMessage ?? null
      }
    });

    return { event, isDuplicate: false };
  }

  /**
   * Mark a webhook event as processed, ignored, or failed.
   */
  async markStatus(id: string, status: WebhookStatus, errorMessage?: string | null) {
    return this.prisma.webhookEvent.update({
      where: { id },
      data: {
        status,
        processedAt: status === 'processed' || status === 'ignored' ? new Date() : null,
        errorMessage: errorMessage ?? null
      }
    });
  }
}
