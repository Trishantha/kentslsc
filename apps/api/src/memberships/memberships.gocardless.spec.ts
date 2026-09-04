import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { MembershipsService } from './memberships.service.js';
import { MembershipStatus, PaymentStatus, PaymentSourceType } from '@kentslsc/database';

jest.mock('gocardless-nodejs', () => ({
  GoCardlessClient: jest.fn(),
  Environments: { Live: 'live', Sandbox: 'sandbox' }
}));

const mockPaidMembershipType = {
  id: 'type-paid',
  name: 'Paid Membership',
  description: null,
  price: 50,
  isFree: false,
  durationMonths: 12,
  maxIssuances: null,
  benefits: [],
  features: [],
  autoActivate: true,
  grantsMemberRole: true,
  createdAt: new Date(),
  updatedAt: new Date(),
  deletedAt: null
};

function buildMembership(overrides: any = {}) {
  return {
    id: 'membership-1',
    userId: 'user-1',
    membershipTypeId: 'type-paid',
    membershipId: 'MEM-ABCDEFGH',
    startDate: new Date('2026-01-01T00:00:00Z'),
    endDate: new Date('2027-01-01T00:00:00Z'),
    status: MembershipStatus.AWAITING_PAYMENT,
    paidAt: null,
    paymentMethod: null,
    dependantsJson: null,
    membershipCardUrl: null,
    qrCodeValue: 'http://localhost:3000/membership/verify/MEM-ABCDEFGH',
    gocardlessMandateId: null,
    gocardlessSubscriptionId: null,
    gocardlessInstalmentScheduleId: null,
    creditAmountApplied: null,
    creditMonthsGranted: null,
    stripeCustomerId: null,
    stripeSubscriptionId: null,
    stripePriceId: null,
    subscriptionStatus: null,
    rejectionReason: null,
    issuedAt: new Date(),
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
    membershipType: mockPaidMembershipType,
    user: { id: 'user-1', name: 'Test User', email: 'test@example.com' },
    ...overrides
  };
}

function buildGoCardlessPayment(overrides: any = {}) {
  return {
    id: 'PM123',
    amount: '5000',
    currency: 'GBP',
    status: 'confirmed',
    charge_date: '2026-09-03',
    created_at: '2026-09-03T10:00:00.000Z',
    description: 'Membership payment',
    metadata: {},
    links: {
      billing_request: 'BR123',
      mandate: 'MD123'
    },
    ...overrides
  };
}

describe('MembershipsService GoCardless handlers', () => {
  let service: MembershipsService;

  const mockPrisma: any = {
    membership: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn()
    },
    payment: {
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn()
    },
    user: {
      findUnique: jest.fn()
    },
    siteSettings: {
      findFirst: jest.fn()
    }
  };

  const mockPaymentsService: any = {
    calculateProcessingFee: jest.fn((netPence: number) => ({ net: netPence, fee: 20, gross: netPence + 20 })),
    getPublicPaymentSettings: (jest.fn() as jest.Mock<() => Promise<any>>).mockResolvedValue({
      provider: 'gocardless',
      processingFeeEnabled: true,
      processingFeePercent: 1.5,
      processingFeeFixed: 20
    }),
    resolveCheckoutMethod: (jest.fn() as jest.Mock<() => Promise<any>>).mockResolvedValue({
      method: 'direct_debit',
      provider: 'gocardless'
    }),
    getOrCreateStripeCustomer: (jest.fn() as jest.Mock<() => Promise<string>>).mockResolvedValue('cus_test'),
    syncMembershipTypePrice: (jest.fn() as jest.Mock<(...args: any[]) => Promise<any>>).mockResolvedValue({
      productId: 'prod_test',
      priceId: 'price_test'
    }),
    createSubscriptionCheckout: (jest.fn() as jest.Mock<(...args: any[]) => Promise<any>>).mockResolvedValue({
      provider: 'stripe',
      id: 'cs_test_123',
      url: 'https://checkout.stripe.test/pay'
    })
  };

  const mockRefundsService: any = {
    refundPayment: jest.fn()
  };

  const mockEmailService: any = {
    send: jest.fn(),
    sendMembershipPaymentLink: jest.fn(),
    sendMembershipAwaitingApprovalEmail: jest.fn(),
    sendMembershipApplicationAdminNotification: jest.fn()
  };

  const mockAiService: any = {
    welcome: (jest.fn() as jest.Mock<(...args: any[]) => Promise<any>>).mockResolvedValue('Welcome!')
  };

  const mockConfigService: any = {
    get: jest.fn((key: string) => {
      if (key === 'FRONTEND_URL') return 'http://localhost:3000';
      if (key === 'API_URL') return 'http://localhost:4000';
      return undefined;
    })
  };

  const mockSupabaseStorage: any = {
    uploadBuffer: (jest.fn() as jest.Mock<(...args: any[]) => Promise<any>>).mockResolvedValue({
      url: 'https://cards.example/MEM-ABCDEFGH.png'
    })
  };

  const mockGoCardlessService: any = {
    getBillingRequest: jest.fn(),
    getPayment: jest.fn(),
    getOrCreateCustomer: (jest.fn() as jest.Mock<() => Promise<string>>).mockResolvedValue('CU123'),
    createBillingRequestFlow: (jest.fn() as jest.Mock<(...args: any[]) => Promise<any>>).mockResolvedValue({
      provider: 'gocardless',
      id: 'BR123',
      url: 'https://pay.gocardless.test/flow/BR123'
    })
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockPrisma.user.findUnique.mockResolvedValue({ role: 'ADMIN' });
    mockPrisma.siteSettings.findFirst.mockResolvedValue(null);
    mockSupabaseStorage.uploadBuffer.mockResolvedValue({ url: 'https://cards.example/MEM-ABCDEFGH.png' });
    service = new MembershipsService(
      mockPrisma,
      mockPaymentsService,
      mockRefundsService,
      mockEmailService,
      mockAiService,
      mockConfigService,
      mockSupabaseStorage,
      mockGoCardlessService
    );
  });

  describe('handleGoCardlessPaymentCompleted', () => {
    it('activates the membership, records the payment and emails the member on first payment', async () => {
      const membership = buildMembership();
      const payment = buildGoCardlessPayment();

      mockPrisma.payment.findFirst
        .mockResolvedValueOnce(null) // idempotency check
        .mockResolvedValueOnce(null); // no prior completed payment
      mockPrisma.membership.findUnique.mockResolvedValue(membership);
      mockPrisma.membership.update.mockResolvedValue({ ...membership, status: MembershipStatus.ACTIVE });
      mockPrisma.payment.create.mockResolvedValue({ id: 'pay-1' });
      mockPrisma.user.findUnique.mockResolvedValue({ email: 'test@example.com', role: 'ADMIN' });

      const result = await service.handleGoCardlessPaymentCompleted(payment, {
        source: 'membership',
        membershipId: membership.id,
        userId: membership.userId
      });

      expect(result).toEqual({ received: true, membershipId: membership.membershipId });
      expect(mockPrisma.membership.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: membership.id },
          data: expect.objectContaining({
            status: MembershipStatus.ACTIVE,
            paymentMethod: 'direct_debit',
            paidAt: expect.any(Date),
            gocardlessMandateId: 'MD123'
          })
        })
      );
      expect(mockPrisma.payment.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            membershipId: membership.id,
            paymentChannel: 'gocardless',
            paymentMethod: 'direct_debit',
            paymentStatus: PaymentStatus.COMPLETED,
            providerPaymentId: 'PM123',
            providerCheckoutId: 'BR123',
            sourceType: PaymentSourceType.MEMBERSHIP
          })
        })
      );
      // Card uploaded and welcome email sent.
      expect(mockSupabaseStorage.uploadBuffer).toHaveBeenCalled();
      expect(mockEmailService.send).toHaveBeenCalledWith(
        expect.objectContaining({ to: 'test@example.com', subject: 'Welcome to Kent SLSC' })
      );
    });

    it('does nothing when a payment with the same providerPaymentId was already recorded', async () => {
      mockPrisma.payment.findFirst.mockResolvedValue({
        id: 'pay-1',
        providerPaymentId: 'PM123',
        membershipId: 'membership-1'
      });

      const result = await service.handleGoCardlessPaymentCompleted(buildGoCardlessPayment(), {
        source: 'membership',
        membershipId: 'membership-1'
      });

      expect(result).toEqual({ received: true, membershipId: 'membership-1' });
      expect(mockPrisma.payment.create).not.toHaveBeenCalled();
      expect(mockPrisma.membership.update).not.toHaveBeenCalled();
      expect(mockEmailService.send).not.toHaveBeenCalled();
    });

    it('extends endDate by one membership-type duration on renewal payments', async () => {
      const currentEnd = new Date('2026-12-01T00:00:00Z');
      const membership = buildMembership({
        status: MembershipStatus.ACTIVE,
        paidAt: new Date('2025-12-01T00:00:00Z'),
        endDate: currentEnd,
        gocardlessMandateId: 'MD123'
      });
      const payment = buildGoCardlessPayment({
        links: { billing_request: 'BR123', mandate: 'MD123', subscription: 'SB123' }
      });

      const expectedEnd = new Date(currentEnd);
      expectedEnd.setMonth(expectedEnd.getMonth() + mockPaidMembershipType.durationMonths);

      mockPrisma.payment.findFirst
        .mockResolvedValueOnce(null) // idempotency check
        .mockResolvedValueOnce({ id: 'pay-previous' }) // prior completed payment → renewal
        .mockResolvedValueOnce(null); // recordMembershipPayment dedupe check
      mockPrisma.membership.findUnique.mockResolvedValue(membership);
      mockPrisma.membership.update.mockResolvedValue(membership);
      mockPrisma.payment.create.mockResolvedValue({ id: 'pay-2' });

      await service.handleGoCardlessPaymentCompleted(payment, {
        source: 'membership',
        membershipId: membership.id
      });

      expect(mockPrisma.membership.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            endDate: expectedEnd,
            gocardlessSubscriptionId: 'SB123',
            subscriptionStatus: 'active'
          })
        })
      );
      expect(mockPrisma.payment.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ providerSubscriptionId: 'SB123' })
        })
      );
      // Renewals do not re-send the welcome email.
      expect(mockEmailService.send).not.toHaveBeenCalled();
    });

    it('falls back to the pending payment row when metadata has no membershipId', async () => {
      const membership = buildMembership();
      const payment = buildGoCardlessPayment();

      mockPrisma.payment.findFirst
        .mockResolvedValueOnce(null) // idempotency check
        .mockResolvedValueOnce({ id: 'pay-pending', membership }) // pending row by billing request
        .mockResolvedValueOnce(null) // no prior completed payment
        .mockResolvedValueOnce(null); // recordMembershipPayment dedupe check
      mockPrisma.membership.update.mockResolvedValue({ ...membership, status: MembershipStatus.ACTIVE });
      mockPrisma.payment.create.mockResolvedValue({ id: 'pay-1' });

      const result = await service.handleGoCardlessPaymentCompleted(payment, { source: 'membership' });

      expect(result).toEqual({ received: true, membershipId: membership.membershipId });
      expect(mockPrisma.membership.findUnique).not.toHaveBeenCalled();
      expect(mockPrisma.membership.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ status: MembershipStatus.ACTIVE }) })
      );
    });

    it('matches a confirmed subscription payment without checkout metadata', async () => {
      const membership = buildMembership({ gocardlessSubscriptionId: 'SB123' });
      const payment = buildGoCardlessPayment({
        links: { subscription: 'SB123', mandate: 'MD123' }
      });

      mockPrisma.payment.findFirst
        .mockResolvedValueOnce(null) // idempotency check
        .mockResolvedValueOnce(null) // no prior completed payment
        .mockResolvedValueOnce(null); // recordMembershipPayment dedupe check
      mockPrisma.membership.findFirst.mockResolvedValue(membership);
      mockPrisma.membership.update.mockResolvedValue({ ...membership, status: MembershipStatus.ACTIVE });
      mockPrisma.payment.create.mockResolvedValue({ id: 'pay-1' });

      const result = await service.handleGoCardlessPaymentCompleted(payment, {});

      expect(result).toEqual({ received: true, membershipId: membership.membershipId });
      expect(mockPrisma.membership.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({ where: { gocardlessSubscriptionId: 'SB123', deletedAt: null } })
      );
      expect(mockPrisma.membership.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ status: MembershipStatus.ACTIVE }) })
      );
    });
  });

  describe('handleGoCardlessPaymentFailed', () => {
    it('marks the payment failed and returns an unpaid membership to awaiting payment', async () => {
      const membership = buildMembership({ status: MembershipStatus.ACTIVE });
      const payment = buildGoCardlessPayment({ status: 'failed' });

      mockPrisma.payment.findFirst
        .mockResolvedValueOnce({ id: 'pay-1', membershipId: membership.id, notes: null }) // the failed row
        .mockResolvedValueOnce(null); // no successful payment
      mockPrisma.membership.findUnique.mockResolvedValue(membership);
      mockPrisma.membership.update.mockResolvedValue({
        ...membership,
        status: MembershipStatus.AWAITING_PAYMENT
      });
      mockPrisma.payment.update.mockResolvedValue({});

      const result = await service.handleGoCardlessPaymentFailed(payment);

      expect(result.membershipId).toBe(membership.membershipId);
      expect(mockPrisma.payment.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'pay-1' },
          data: expect.objectContaining({ paymentStatus: PaymentStatus.FAILED })
        })
      );
      expect(mockPrisma.membership.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: membership.id },
          data: { status: MembershipStatus.AWAITING_PAYMENT }
        })
      );
    });

    it('keeps the membership active when an earlier payment succeeded', async () => {
      const membership = buildMembership({ status: MembershipStatus.ACTIVE });
      const payment = buildGoCardlessPayment({ status: 'failed' });

      mockPrisma.payment.findFirst
        .mockResolvedValueOnce({ id: 'pay-2', membershipId: membership.id, notes: null })
        .mockResolvedValueOnce({ id: 'pay-1' }); // earlier successful payment
      mockPrisma.payment.update.mockResolvedValue({});

      await service.handleGoCardlessPaymentFailed(payment);

      expect(mockPrisma.membership.update).not.toHaveBeenCalled();
    });
  });

  describe('handleGoCardlessMandateCancelled', () => {
    it('cancels the membership when it has no GoCardless subscription or schedule', async () => {
      const membership = buildMembership({ status: MembershipStatus.ACTIVE, gocardlessMandateId: 'MD123' });

      mockPrisma.membership.findFirst.mockResolvedValue(membership);
      mockPrisma.membership.update.mockResolvedValue({ ...membership, status: MembershipStatus.CANCELLED });

      const result = await service.handleGoCardlessMandateCancelled({ id: 'MD123', status: 'cancelled' });

      expect(result).toEqual({ received: true, membershipId: membership.membershipId });
      expect(mockPrisma.membership.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: membership.id },
          data: expect.objectContaining({
            status: MembershipStatus.CANCELLED,
            endDate: expect.any(Date),
            subscriptionStatus: 'cancelled'
          })
        })
      );
    });

    it('leaves the membership alone while a GoCardless subscription is active', async () => {
      const membership = buildMembership({
        status: MembershipStatus.ACTIVE,
        gocardlessMandateId: 'MD123',
        gocardlessSubscriptionId: 'SB123'
      });

      mockPrisma.membership.findFirst.mockResolvedValue(membership);

      const result = await service.handleGoCardlessMandateCancelled({ id: 'MD123', status: 'cancelled' });

      expect(result).toEqual({ received: true, membershipId: membership.membershipId });
      expect(mockPrisma.membership.update).not.toHaveBeenCalled();
    });
  });

  describe('handleGoCardlessSubscriptionStatus', () => {
    it('cancels the membership when the subscription is cancelled', async () => {
      const membership = buildMembership({
        status: MembershipStatus.ACTIVE,
        gocardlessSubscriptionId: 'SB123'
      });

      mockPrisma.membership.findFirst.mockResolvedValue(membership);
      mockPrisma.membership.update.mockResolvedValue({ ...membership, status: MembershipStatus.CANCELLED });

      const result = await service.handleGoCardlessSubscriptionStatus(
        { id: 'SB123', status: 'cancelled' },
        'cancelled'
      );

      expect(result).toEqual({ received: true, membershipId: membership.membershipId });
      expect(mockPrisma.membership.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ subscriptionStatus: 'cancelled', status: MembershipStatus.CANCELLED })
        })
      );
    });
  });

  describe('handleGoCardlessInstalmentScheduleCreated', () => {
    it('stores the schedule id on the membership from metadata', async () => {
      const membership = buildMembership();

      mockPrisma.membership.findUnique.mockResolvedValue(membership);
      mockPrisma.membership.update.mockResolvedValue(membership);

      const result = await service.handleGoCardlessInstalmentScheduleCreated(
        { id: 'IS123', status: 'active' },
        { source: 'membership', membershipId: membership.id }
      );

      expect(result).toEqual({ received: true, membershipId: membership.membershipId });
      expect(mockPrisma.membership.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ gocardlessInstalmentScheduleId: 'IS123' })
        })
      );
    });
  });

  describe('approveAndRequestPayment provider branching', () => {
    const awaitingApproval = () =>
      buildMembership({
        status: MembershipStatus.AWAITING_APPROVAL,
        paidAt: null,
        stripeSubscriptionId: null
      });

    it('creates a GoCardless subscription billing request with membership metadata and a pending payment row', async () => {
      const membership = awaitingApproval();

      mockPrisma.membership.findFirst.mockResolvedValue(membership);
      mockPrisma.membership.update.mockResolvedValue(membership);
      mockPrisma.membership.findUnique.mockResolvedValue(membership);

      const result = await service.approveAndRequestPayment(membership.id);

      expect(mockGoCardlessService.getOrCreateCustomer).toHaveBeenCalledWith(membership.userId);
      expect(mockGoCardlessService.createBillingRequestFlow).toHaveBeenCalledWith(
        expect.objectContaining({
          plan: 'subscription',
          amountPence: 5000,
          subscriptionIntervalUnit: 'yearly',
          subscriptionInterval: 1,
          metadata: expect.objectContaining({
            source: 'membership',
            membershipId: membership.id,
            userId: membership.userId
          }),
          redirectUri: expect.stringContaining('membership=success&session_id={BILLING_REQUEST_ID}')
        })
      );
      expect(mockPrisma.payment.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            userId: membership.userId,
            membershipId: membership.id,
            paymentChannel: 'gocardless',
            paymentMethod: 'direct_debit',
            paymentStatus: PaymentStatus.PENDING,
            providerCheckoutId: 'BR123',
            sourceType: PaymentSourceType.MEMBERSHIP,
            grossAmount: 50,
            processingFee: 0.2
          })
        })
      );
      expect(mockEmailService.sendMembershipPaymentLink).toHaveBeenCalledWith(
        'test@example.com',
        'Test User',
        'Paid Membership',
        'https://pay.gocardless.test/flow/BR123'
      );
      expect(result).toEqual({
        membership: expect.anything(),
        url: 'https://pay.gocardless.test/flow/BR123',
        provider: 'gocardless'
      });
      // Stripe checkout must not be touched on the GoCardless path.
      expect(mockPaymentsService.createSubscriptionCheckout).not.toHaveBeenCalled();
    });

    it('uses a monthly subscription interval for non-yearly membership durations', async () => {
      const membership = awaitingApproval();
      membership.membershipType = { ...mockPaidMembershipType, durationMonths: 6 };

      mockPrisma.membership.findFirst.mockResolvedValue(membership);
      mockPrisma.membership.update.mockResolvedValue(membership);
      mockPrisma.membership.findUnique.mockResolvedValue(membership);

      await service.approveAndRequestPayment(membership.id);

      expect(mockGoCardlessService.createBillingRequestFlow).toHaveBeenCalledWith(
        expect.objectContaining({
          plan: 'subscription',
          subscriptionIntervalUnit: 'monthly',
          subscriptionInterval: 6
        })
      );
    });

    it('keeps the Stripe path untouched when the effective provider is stripe', async () => {
      mockPaymentsService.resolveCheckoutMethod.mockResolvedValueOnce({
        method: 'card',
        provider: 'stripe'
      });
      const membership = awaitingApproval();

      mockPrisma.membership.findFirst.mockResolvedValue(membership);
      mockPrisma.membership.update.mockResolvedValue(membership);
      mockPrisma.membership.findUnique.mockResolvedValue(membership);

      const result = await service.approveAndRequestPayment(membership.id);

      expect(mockGoCardlessService.createBillingRequestFlow).not.toHaveBeenCalled();
      expect(mockGoCardlessService.getOrCreateCustomer).not.toHaveBeenCalled();
      expect(mockPaymentsService.createSubscriptionCheckout).toHaveBeenCalled();
      expect(result).toEqual({
        membership: expect.anything(),
        url: 'https://checkout.stripe.test/pay',
        provider: 'stripe'
      });
    });

    it('uses the Stripe checkout when the admin picks card, even under a GoCardless default', async () => {
      const membership = awaitingApproval();

      mockPrisma.membership.findFirst.mockResolvedValue(membership);
      mockPrisma.membership.update.mockResolvedValue(membership);
      mockPrisma.membership.findUnique.mockResolvedValue(membership);
      mockPaymentsService.resolveCheckoutMethod.mockResolvedValueOnce({
        method: 'card',
        provider: 'stripe'
      });

      const result = await service.approveAndRequestPayment(membership.id, 'card');

      expect(mockPaymentsService.resolveCheckoutMethod).toHaveBeenCalledWith('card');
      expect(mockGoCardlessService.createBillingRequestFlow).not.toHaveBeenCalled();
      expect(mockPaymentsService.createSubscriptionCheckout).toHaveBeenCalled();
      expect(result).toEqual({
        membership: expect.anything(),
        url: 'https://checkout.stripe.test/pay',
        provider: 'stripe'
      });
    });
  });
});
