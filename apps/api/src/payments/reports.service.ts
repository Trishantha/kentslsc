import { Injectable } from '@nestjs/common';
import { PrismaService } from '../core/prisma/prisma.service.js';
import { PaymentStatus, PaymentSourceType } from '@kentslsc/database';
import type { Prisma } from '@kentslsc/database';

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
  description: string | null;
  createdAt: string;
}

@Injectable()
export class PaymentReportsService {
  constructor(private readonly prisma: PrismaService) {}

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
        { providerCheckoutId: { contains: term, mode: 'insensitive' } },
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
          membership: { select: { id: true, membershipId: true } },
          donation: true,
          businessListing: { select: { id: true, businessName: true } },
          jobAd: { select: { id: true, title: true } },
          user: { select: { id: true, name: true, email: true, phone: true } }
        }
      }),
      this.prisma.payment.count({ where }),
      this.prisma.payment.aggregate({
        where,
        _sum: { grossAmount: true, processingFee: true, netAmount: true, refundedAmount: true }
      })
    ]);

    const rows: RevenueReportRow[] = data.map((p) => ({
      id: p.id,
      date: p.purchasedAt?.toISOString() ?? p.createdAt.toISOString(),
      name: p.payerName,
      addressLine1: p.payerAddressLine1,
      addressLine2: p.payerAddressLine2,
      city: p.payerCity,
      postcode: p.payerPostcode,
      country: p.payerCountry,
      contactNumber: p.payerPhone,
      email: p.payerEmail,
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
      description: p.description,
      createdAt: p.createdAt.toISOString()
    }));

    return {
      rows,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
      aggregates: {
        gross: Number(aggregates._sum.grossAmount ?? 0),
        fees: Number(aggregates._sum.processingFee ?? 0),
        net: Number(aggregates._sum.netAmount ?? 0),
        refunded: Number(aggregates._sum.refundedAmount ?? 0)
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
        membership: { select: { id: true, membershipId: true } },
        donation: true,
        businessListing: { select: { id: true, businessName: true } },
        jobAd: { select: { id: true, title: true } },
        user: { select: { id: true, name: true, email: true, phone: true } }
      }
    });

    return data.map((p) => ({
      id: p.id,
      date: p.purchasedAt?.toISOString() ?? p.createdAt.toISOString(),
      name: p.payerName,
      addressLine1: p.payerAddressLine1,
      addressLine2: p.payerAddressLine2,
      city: p.payerCity,
      postcode: p.payerPostcode,
      country: p.payerCountry,
      contactNumber: p.payerPhone,
      email: p.payerEmail,
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
      description: p.description,
      createdAt: p.createdAt.toISOString()
    }));
  }
}
