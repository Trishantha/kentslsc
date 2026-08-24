import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { UsersService } from './users.service.js';
import { NotFoundException } from '@nestjs/common';
import { PaymentStatus, PaymentSourceType } from '@kentslsc/database';

describe('UsersService', () => {
  let service: UsersService;
  const prisma = {
    user: {
      findUnique: jest.fn()
    },
    payment: {
      findMany: jest.fn()
    },
    membership: {
      findMany: jest.fn()
    },
    ticket: {
      findMany: jest.fn()
    },
    businessListing: {
      findMany: jest.fn()
    },
    donation: {
      findMany: jest.fn()
    },
    forumTopic: {
      findMany: jest.fn()
    },
    forumPost: {
      findMany: jest.fn()
    }
  } as any;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new UsersService(prisma);
  });

  describe('getUserTransactions', () => {
    it('throws NotFoundException when user does not exist', async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      await expect(service.getUserTransactions('missing')).rejects.toBeInstanceOf(NotFoundException);
    });

    it('returns all payments for the user with related entities', async () => {
      prisma.user.findUnique.mockResolvedValue({ id: 'user-1' });
      prisma.payment.findMany.mockResolvedValue([
        {
          id: 'pay-1',
          receiptNumber: 'KS-2026-000001',
          purchasedAt: new Date('2026-08-24T10:00:00Z'),
          createdAt: new Date('2026-08-24T10:00:00Z'),
          description: 'Ticket(s) for Summer Event',
          currency: 'GBP',
          grossAmount: 10.35,
          processingFee: 0.35,
          netAmount: 10,
          refundedAmount: null,
          paymentChannel: 'stripe',
          paymentMethod: 'card',
          paymentStatus: PaymentStatus.COMPLETED,
          sourceType: PaymentSourceType.TICKET,
          sourceId: 't-1',
          event: { id: 'event-1', title: 'Summer Event' },
          membership: null,
          donation: null,
          businessListing: null,
          jobAd: null
        }
      ]);

      const result = await service.getUserTransactions('user-1');

      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        id: 'pay-1',
        receiptNumber: 'KS-2026-000001',
        grossAmount: 10.35,
        processingFee: 0.35,
        netAmount: 10,
        paymentChannel: 'stripe',
        paymentStatus: PaymentStatus.COMPLETED,
        sourceType: PaymentSourceType.TICKET,
        related: {
          event: { id: 'event-1', title: 'Summer Event' }
        }
      });
      expect(prisma.payment.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { userId: 'user-1', deletedAt: null },
          orderBy: { purchasedAt: 'desc' }
        })
      );
    });
  });
});
