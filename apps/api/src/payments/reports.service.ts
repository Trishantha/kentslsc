import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../core/prisma/prisma.service.js';
import { PaymentStatus, PaymentSourceType } from '@kentslsc/database';
import type { Prisma } from '@kentslsc/database';
import { PaymentsService } from './payments.service.js';

export interface RevenueReportFilters {
  from?: Date;
  to?: Date;
  sourceType?: PaymentSourceType;
  channel?: string;
  status?: PaymentStatus;
  search?: string;
  page?: number;
  limit?: number;
}

export interface RevenueReportRow {
  id: string;
  date: string;
  receiptNumber: string | null;
  name: string | null;
  addressLine1: string | null;
  addressLine2: string | null;
  city: string | null;
  postcode: string | null;
  country: string | null;
  contactNumber: string | null;
  email: string | null;
  notes: string | null;
  currency: string;
  amount: number;
  fees: number;
  netPayment: number;
  refundedAmount: number | null;
  paymentChannel: string;
  paymentId: string | null;
  paymentDate: string | null;
  paymentMethod: string | null;
  paymentStatus: PaymentStatus;
  sourceType: PaymentSourceType;
  sourceId: string | null;
  subscriptionId: string | null;
  description: string | null;
  createdAt: string;
}

export type PayoutMatchStatus = 'matched' | 'unmatched' | 'partial';

export interface PayoutReconciliationFilters {
  from?: Date;
  to?: Date;
  status?: string;
  matchStatus?: PayoutMatchStatus;
  page?: number;
  limit?: number;
}

export interface PayoutReconciliationRow {
  payoutId: string;
  arrivalDate: string;
  status: string;
  currency: string;
  gross: number;
  fees: number;
  net: number;
  expectedLedgerNet: number;
  matchedPaymentCount: number;
  unmatchedTxnCount: number;
  unmatchedAmount: number;
  variance: number;
}

const MATCHED_LEDGER_TXN_TYPES = ['charge', 'payment', 'refund'];

const round2 = (value: number) => Math.round(value * 100) / 100;

@Injectable()
export class PaymentReportsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly paymentsService: PaymentsService
  ) {}

  private buildWhere(filters: RevenueReportFilters): Prisma.PaymentWhereInput {
    const where: Prisma.PaymentWhereInput = { deletedAt: null };

    if (filters.from || filters.to) {
      where.purchasedAt = {};
      if (filters.from) where.purchasedAt.gte = filters.from;
      if (filters.to) where.purchasedAt.lte = filters.to;
    }

    if (filters.sourceType) {
      where.sourceType = filters.sourceType;
    }

    if (filters.channel) {
      where.paymentChannel = { equals: filters.channel, mode: 'insensitive' };
    }

    if (filters.status) {
      where.paymentStatus = filters.status;
    }

    if (filters.search) {
      const term = filters.search.trim();
      where.OR = [
        { payerName: { contains: term, mode: 'insensitive' } },
        { payerEmail: { contains: term, mode: 'insensitive' } },
        { description: { contains: term, mode: 'insensitive' } },
        { providerPaymentId: { contains: term, mode: 'insensitive' } },
        { providerSubscriptionId: { contains: term, mode: 'insensitive' } },
        { providerCheckoutId: { contains: term, mode: 'insensitive' } },
        { receiptNumber: { contains: term, mode: 'insensitive' } },
        { notes: { contains: term, mode: 'insensitive' } }
      ];
    }

    return where;
  }

  async getRevenueReport(filters: RevenueReportFilters) {
    const where = this.buildWhere(filters);
    const page = filters.page ?? 1;
    const limit = Math.min(filters.limit ?? 50, 500);

    const [data, total, aggregates] = await Promise.all([
      this.prisma.payment.findMany({
        where,
        orderBy: { purchasedAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        include: {
          event: { select: { id: true, title: true } },
          ticket: true,
          membership: { select: { id: true, membershipId: true, stripeSubscriptionId: true } },
          donation: true,
          businessListing: { select: { id: true, businessName: true } },
          jobAd: { select: { id: true, title: true } },
          user: { select: { id: true, name: true, firstName: true, lastName: true, email: true, phone: true, address: true } }
        }
      }),
      this.prisma.payment.count({ where }),
      this.prisma.payment.aggregate({
        where,
        _sum: { grossAmount: true, processingFee: true, netAmount: true, refundedAmount: true }
      })
    ]);

    const rows: RevenueReportRow[] = data.map((p) => {
      const userAddress = (p.user?.address ?? null) as {
        buildingStreet?: string | null;
        locality?: string | null;
        townCity?: string | null;
        postcode?: string | null;
      } | null;
      const userName = p.user
        ? [p.user.firstName, p.user.lastName].filter(Boolean).join(' ').trim() || p.user.name
        : null;

      return {
        id: p.id,
        date: p.purchasedAt?.toISOString() ?? p.createdAt.toISOString(),
        receiptNumber: p.receiptNumber,
        name: userName ?? p.payerName,
        addressLine1: userAddress?.buildingStreet ?? p.payerAddressLine1,
        addressLine2: userAddress?.locality ?? p.payerAddressLine2,
        city: userAddress?.townCity ?? p.payerCity,
        postcode: userAddress?.postcode ?? p.payerPostcode,
        country: p.payerCountry,
        contactNumber: p.user?.phone ?? p.payerPhone,
        email: p.user?.email ?? p.payerEmail,
        notes: p.notes,
        currency: p.currency,
        amount: Number(p.grossAmount),
        fees: Number(p.processingFee),
        netPayment: Number(p.netAmount),
        refundedAmount: p.refundedAmount ? Number(p.refundedAmount) : null,
        paymentChannel: p.paymentChannel,
        paymentId: p.providerPaymentId,
        paymentDate: p.purchasedAt?.toISOString() ?? null,
        paymentMethod: p.paymentMethod,
        paymentStatus: p.paymentStatus,
        sourceType: p.sourceType,
        sourceId: p.sourceId,
        subscriptionId: p.providerSubscriptionId ?? p.membership?.stripeSubscriptionId ?? null,
        description: p.description,
        createdAt: p.createdAt.toISOString()
      };
    });

    const gross = Number(aggregates._sum.grossAmount ?? 0);
    const fees = Number(aggregates._sum.processingFee ?? 0);
    const refunded = Number(aggregates._sum.refundedAmount ?? 0);

    return {
      rows,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
      aggregates: {
        gross,
        fees,
        net: gross - fees - refunded,
        refunded
      }
    };
  }

  async getAllForExport(filters: Omit<RevenueReportFilters, 'page' | 'limit'>) {
    const where = this.buildWhere(filters);
    const data = await this.prisma.payment.findMany({
      where,
      orderBy: { purchasedAt: 'desc' },
      include: {
        event: { select: { id: true, title: true } },
        ticket: true,
        membership: { select: { id: true, membershipId: true, stripeSubscriptionId: true } },
        donation: true,
        businessListing: { select: { id: true, businessName: true } },
        jobAd: { select: { id: true, title: true } },
        user: { select: { id: true, name: true, firstName: true, lastName: true, email: true, phone: true, address: true } }
      }
    });

    return data.map((p) => {
      const userAddress = (p.user?.address ?? null) as {
        buildingStreet?: string | null;
        locality?: string | null;
        townCity?: string | null;
        postcode?: string | null;
      } | null;
      const userName = p.user
        ? [p.user.firstName, p.user.lastName].filter(Boolean).join(' ').trim() || p.user.name
        : null;

      return {
        id: p.id,
        date: p.purchasedAt?.toISOString() ?? p.createdAt.toISOString(),
        receiptNumber: p.receiptNumber,
        name: userName ?? p.payerName,
        addressLine1: userAddress?.buildingStreet ?? p.payerAddressLine1,
        addressLine2: userAddress?.locality ?? p.payerAddressLine2,
        city: userAddress?.townCity ?? p.payerCity,
        postcode: userAddress?.postcode ?? p.payerPostcode,
        country: p.payerCountry,
        contactNumber: p.user?.phone ?? p.payerPhone,
        email: p.user?.email ?? p.payerEmail,
        notes: p.notes,
        currency: p.currency,
        amount: Number(p.grossAmount),
        fees: Number(p.processingFee),
        netPayment: Number(p.netAmount),
        refundedAmount: p.refundedAmount ? Number(p.refundedAmount) : null,
        paymentChannel: p.paymentChannel,
        paymentId: p.providerPaymentId,
        paymentDate: p.purchasedAt?.toISOString() ?? null,
        paymentMethod: p.paymentMethod,
        paymentStatus: p.paymentStatus,
        sourceType: p.sourceType,
        sourceId: p.sourceId,
        subscriptionId: p.providerSubscriptionId ?? p.membership?.stripeSubscriptionId ?? null,
        description: p.description,
        createdAt: p.createdAt.toISOString()
      };
    });
  }

  async getPayoutReconciliation(filters: PayoutReconciliationFilters) {
    const where: Prisma.StripePayoutWhereInput = {};
    if (filters.from || filters.to) {
      where.arrivalDate = {};
      if (filters.from) where.arrivalDate.gte = filters.from;
      if (filters.to) where.arrivalDate.lte = filters.to;
    }
    if (filters.status) where.status = { equals: filters.status, mode: 'insensitive' };

    const payouts = await this.prisma.stripePayout.findMany({
      where,
      orderBy: { arrivalDate: 'desc' }
    });

    const rows: PayoutReconciliationRow[] = [];
    for (const payout of payouts) {
      rows.push(await this.buildReconciliationRow(payout));
    }

    const filtered = filters.matchStatus
      ? rows.filter((row) => {
          if (filters.matchStatus === 'matched') return row.variance === 0;
          if (filters.matchStatus === 'unmatched') return row.matchedPaymentCount === 0;
          return row.variance !== 0 && row.matchedPaymentCount > 0;
        })
      : rows;

    const page = filters.page ?? 1;
    const limit = Math.min(filters.limit ?? 50, 500);
    const paged = filtered.slice((page - 1) * limit, (page - 1) * limit + limit);

    return {
      rows: paged,
      total: filtered.length,
      page,
      limit,
      totalPages: Math.ceil(filtered.length / limit),
      aggregates: {
        gross: round2(filtered.reduce((sum, row) => sum + row.gross, 0)),
        fees: round2(filtered.reduce((sum, row) => sum + row.fees, 0)),
        net: round2(filtered.reduce((sum, row) => sum + row.net, 0)),
        expectedLedgerNet: round2(filtered.reduce((sum, row) => sum + row.expectedLedgerNet, 0)),
        variance: round2(filtered.reduce((sum, row) => sum + row.variance, 0))
      }
    };
  }

  async getPayoutDetail(payoutId: string) {
    const payout = await this.prisma.stripePayout.findUnique({ where: { payoutId } });
    if (!payout) {
      throw new NotFoundException(`Payout ${payoutId} not found`);
    }

    const transactions = await this.prisma.stripeBalanceTransaction.findMany({
      where: { payoutId },
      orderBy: { created: 'asc' }
    });

    const matched = await this.findMatchedPayments(
      transactions.map((txn) => txn.sourcePaymentIntentId).filter((id): id is string => !!id)
    );

    return {
      payout: {
        payoutId: payout.payoutId,
        arrivalDate: payout.arrivalDate.toISOString(),
        status: payout.status,
        currency: payout.currency,
        amount: Number(payout.amount),
        method: payout.method,
        type: payout.type,
        description: payout.description
      },
      transactions: transactions.map((txn) => {
        const payment = txn.sourcePaymentIntentId ? matched.get(txn.sourcePaymentIntentId) : undefined;
        return {
          transactionId: txn.transactionId,
          type: txn.type,
          amount: Number(txn.amount),
          fee: Number(txn.fee),
          net: Number(txn.net),
          currency: txn.currency,
          availableOn: txn.availableOn.toISOString(),
          created: txn.created.toISOString(),
          description: txn.description,
          sourceId: txn.sourceId,
          sourcePaymentIntentId: txn.sourcePaymentIntentId,
          matchedPayment: payment
            ? {
                receiptNumber: payment.receiptNumber,
                sourceType: payment.sourceType,
                payerName: payment.payerName,
                grossAmount: Number(payment.grossAmount),
                processingFee: Number(payment.processingFee),
                netAmount: Number(payment.netAmount)
              }
            : null
        };
      })
    };
  }

  async getBalanceSummary() {
    const stripe = await this.getStripe();

    const balance = await stripe.balance.retrieve();

    const since = new Date();
    since.setDate(since.getDate() - 30);
    since.setHours(0, 0, 0, 0);

    const transactions = await this.prisma.stripeBalanceTransaction.findMany({
      where: { created: { gte: since } },
      select: { type: true, amount: true, fee: true, created: true }
    });

    const days = new Map<string, { charges: number; refunds: number; fees: number; payouts: number }>();
    for (let i = 0; i < 30; i++) {
      const day = new Date(since);
      day.setDate(day.getDate() + i);
      days.set(day.toISOString().slice(0, 10), { charges: 0, refunds: 0, fees: 0, payouts: 0 });
    }
    for (const txn of transactions) {
      const key = txn.created.toISOString().slice(0, 10);
      const bucket = days.get(key);
      if (!bucket) continue;
      if (txn.type === 'charge') bucket.charges = round2(bucket.charges + Number(txn.amount));
      if (txn.type === 'refund') bucket.refunds = round2(bucket.refunds + Number(txn.amount));
      if (txn.type === 'payout') bucket.payouts = round2(bucket.payouts + Number(txn.amount));
      bucket.fees = round2(bucket.fees + Number(txn.fee));
    }

    return {
      available: balance.available.map((b) => ({ currency: b.currency, amount: b.amount / 100 })),
      pending: balance.pending.map((b) => ({ currency: b.currency, amount: b.amount / 100 })),
      daily: Array.from(days.entries()).map(([date, values]) => ({ date, ...values }))
    };
  }

  /**
   * Matching is done query-time only: balance transactions expose the charge's
   * PaymentIntent id and the ledger stores it in providerPaymentId. No FK ties
   * the tables together, so a backfill of old payments cannot break matching.
   */
  private async findMatchedPayments(paymentIntentIds: string[]) {
    const unique = [...new Set(paymentIntentIds)];
    const matches = new Map<
      string,
      {
        receiptNumber: string | null;
        sourceType: PaymentSourceType;
        payerName: string | null;
        grossAmount: number;
        processingFee: number;
        netAmount: number;
      }
    >();
    if (unique.length === 0) return matches;

    const payments = await this.prisma.payment.findMany({
      where: {
        deletedAt: null,
        paymentChannel: 'stripe',
        providerPaymentId: { in: unique }
      },
      orderBy: { createdAt: 'asc' },
      select: {
        providerPaymentId: true,
        receiptNumber: true,
        sourceType: true,
        payerName: true,
        grossAmount: true,
        processingFee: true,
        netAmount: true
      }
    });

    for (const payment of payments) {
      if (!payment.providerPaymentId || matches.has(payment.providerPaymentId)) continue;
      matches.set(payment.providerPaymentId, {
        receiptNumber: payment.receiptNumber,
        sourceType: payment.sourceType,
        payerName: payment.payerName,
        grossAmount: Number(payment.grossAmount),
        processingFee: Number(payment.processingFee),
        netAmount: Number(payment.netAmount)
      });
    }

    return matches;
  }

  private async buildReconciliationRow(payout: {
    payoutId: string;
    arrivalDate: Date;
    status: string;
    currency: string;
    amount: unknown;
  }): Promise<PayoutReconciliationRow> {
    const transactions = await this.prisma.stripeBalanceTransaction.findMany({
      where: { payoutId: payout.payoutId },
      select: { type: true, amount: true, fee: true, sourcePaymentIntentId: true }
    });

    const matched = await this.findMatchedPayments(
      transactions.map((txn) => txn.sourcePaymentIntentId).filter((id): id is string => !!id)
    );

    const gross = transactions.reduce((sum, txn) => {
      const amount = Number(txn.amount);
      return amount > 0 ? sum + amount : sum;
    }, 0);
    const fees = transactions.reduce((sum, txn) => sum + Number(txn.fee), 0);
    const net = Number(payout.amount);

    let expectedLedgerNet = 0;
    for (const payment of matched.values()) {
      expectedLedgerNet += payment.netAmount;
    }

    const unmatchedTransactions = transactions.filter(
      (txn) =>
        MATCHED_LEDGER_TXN_TYPES.includes(txn.type) &&
        (!txn.sourcePaymentIntentId || !matched.has(txn.sourcePaymentIntentId))
    );
    const unmatchedAmount = unmatchedTransactions.reduce((sum, txn) => sum + Number(txn.amount), 0);

    return {
      payoutId: payout.payoutId,
      arrivalDate: payout.arrivalDate.toISOString(),
      status: payout.status,
      currency: payout.currency,
      gross: round2(gross),
      fees: round2(fees),
      net: round2(net),
      expectedLedgerNet: round2(expectedLedgerNet),
      matchedPaymentCount: matched.size,
      unmatchedTxnCount: unmatchedTransactions.length,
      unmatchedAmount: round2(unmatchedAmount),
      variance: round2(net - expectedLedgerNet)
    };
  }

  private async getStripe() {
    try {
      return await this.paymentsService.getStripeClient();
    } catch {
      throw new BadRequestException(
        'Stripe is not configured. Set STRIPE_SECRET_KEY to enable payments.'
      );
    }
  }
}
