import { Injectable } from '@nestjs/common';
import { createHash } from 'crypto';
import { Prisma } from '@kentslsc/database';
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

  private parsePayload(payload: Buffer | string): unknown {
    try {
      return JSON.parse(payload.toString('utf8'));
    } catch {
      return undefined;
    }
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

    let event;
    try {
      event = await this.prisma.webhookEvent.create({
        data: {
          provider: input.provider,
          eventType: input.eventType,
          externalId: input.externalId ?? null,
          payloadHash,
          payload: this.parsePayload(input.payload) as Prisma.InputJsonValue | undefined,
          status: input.status ?? 'received',
          errorMessage: input.errorMessage ?? null
        }
      });
    } catch (error) {
      if (input.externalId && error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        const existing = await this.prisma.webhookEvent.findUnique({
          where: {
            provider_externalId: {
              provider: input.provider,
              externalId: input.externalId
            }
          }
        });
        if (existing) return { event: existing, isDuplicate: true };
      }
      throw error;
    }

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

  /**
   * Failed events that still have their payload stored and can be replayed.
   */
  async listFailed(limit = 50) {
    return this.prisma.webhookEvent.findMany({
      where: { status: 'failed' },
      orderBy: { createdAt: 'asc' },
      take: limit
    });
  }
}
