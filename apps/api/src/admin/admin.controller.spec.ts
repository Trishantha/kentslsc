import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { AdminController } from './admin.controller.js';
import type { AdminService } from './admin.service.js';
import type { AdminUsersService } from './admin-users.service.js';
import type { UsersService } from '../users/users.service.js';
import type { TicketPaymentReconciliationService } from '../events/ticket-payment-reconciliation.service.js';

jest.mock('gocardless-nodejs', () => ({
  GoCardlessClient: jest.fn(),
  Environments: { Live: 'live', Sandbox: 'sandbox' }
}));

describe('AdminController reconcileTicketPayments', () => {
  const adminService = {} as unknown as jest.Mocked<AdminService>;
  const adminUsers = {} as unknown as jest.Mocked<AdminUsersService>;
  const usersService = {} as unknown as jest.Mocked<UsersService>;

  const ticketReconciliation = {
    sweepStripeTicketIntents: jest.fn()
  } as unknown as jest.Mocked<TicketPaymentReconciliationService>;

  let controller: AdminController;

  beforeEach(() => {
    jest.clearAllMocks();
    ticketReconciliation.sweepStripeTicketIntents.mockResolvedValue({
      found: 3,
      fulfilled: 1,
      skipped: 2,
      skippedReasons: { alreadyFulfilled: 2 }
    });
    controller = new AdminController(
      adminService,
      adminUsers,
      usersService,
      ticketReconciliation
    );
  });

  it('defaults to a 24h window and upcoming events only', async () => {
    const result = await controller.reconcileTicketPayments({});

    expect(ticketReconciliation.sweepStripeTicketIntents).toHaveBeenCalledWith({
      lookbackHours: 24,
      onlyUpcomingEvents: true
    });
    expect(result).toEqual({
      found: 3,
      fulfilled: 1,
      skipped: 2,
      skippedReasons: { alreadyFulfilled: 2 }
    });
  });

  it('passes through explicit options for a retroactive backfill', async () => {
    await controller.reconcileTicketPayments({ lookbackHours: 720, onlyUpcomingEvents: false });

    expect(ticketReconciliation.sweepStripeTicketIntents).toHaveBeenCalledWith({
      lookbackHours: 720,
      onlyUpcomingEvents: false
    });
  });

  it('allows overriding only the lookback window', async () => {
    await controller.reconcileTicketPayments({ lookbackHours: 2160 });

    expect(ticketReconciliation.sweepStripeTicketIntents).toHaveBeenCalledWith({
      lookbackHours: 2160,
      onlyUpcomingEvents: true
    });
  });
});
