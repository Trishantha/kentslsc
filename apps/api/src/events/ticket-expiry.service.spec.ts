import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { TicketExpiryService } from './ticket-expiry.service.js';
import { TicketStatus } from '@kentslsc/database';

describe('TicketExpiryService', () => {
  let service: TicketExpiryService;

  const mockPrisma: any = {
    ticket: {
      findMany: jest.fn(),
      updateMany: jest.fn()
    }
  };

  beforeEach(() => {
    jest.clearAllMocks();
    service = new TicketExpiryService(mockPrisma);
  });

  it('expires valid tickets for events that have ended', async () => {
    const expiredTickets = [
      { id: 't1', eventId: 'event-1' },
      { id: 't2', eventId: 'event-1' },
      { id: 't3', eventId: 'event-2' }
    ];
    mockPrisma.ticket.findMany.mockResolvedValue(expiredTickets);
    mockPrisma.ticket.updateMany.mockResolvedValue({ count: 3 });

    await service.expireTickets();

    expect(mockPrisma.ticket.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          deletedAt: null,
          status: TicketStatus.VALID,
          event: { endDatetime: { lt: expect.any(Date) } }
        })
      })
    );
    expect(mockPrisma.ticket.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: { in: ['t1', 't2', 't3'] } },
        data: expect.objectContaining({ status: TicketStatus.EXPIRED })
      })
    );
  });

  it('does nothing when there are no tickets to expire', async () => {
    mockPrisma.ticket.findMany.mockResolvedValue([]);

    await service.expireTickets();

    expect(mockPrisma.ticket.updateMany).not.toHaveBeenCalled();
  });
});
