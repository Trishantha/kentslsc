import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../core/prisma/prisma.service.js';
import { PaymentsService } from './payments.service.js';
import { PaymentStatus, TicketStatus } from '@kentslsc/database';

export interface RefundPaymentInput {
  amount?: number;
  reason?: string;
}

@Injectable()
export class RefundsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly paymentsService: PaymentsService
  ) {}

  async refundPayment(paymentId: string, input: RefundPaymentInput) {
    const payment = await this.prisma.payment.findUnique({
      where: { id: paymentId, deletedAt: null },
      include: {
        ticket: true,
        membership: true,
        donation: true,
        businessListing: true,
        jobAd: true,
        event: true
      }
    });
    if (!payment) throw new NotFoundException('Payment not found');

    if (payment.paymentStatus === PaymentStatus.REFUNDED) {
      throw new BadRequestException('Payment has already been fully refunded');
    }
    if (payment.paymentStatus !== PaymentStatus.COMPLETED) {
      throw new BadRequestException(`Cannot refund a payment with status ${payment.paymentStatus}`);
    }

    const currentRefunded = Number(payment.refundedAmount ?? 0);
    const requestedAmount = input.amount ?? Number(payment.grossAmount);
    const maxRefundable = Number(payment.grossAmount) - currentRefunded;

    if (requestedAmount <= 0) {
      throw new BadRequestException('Refund amount must be greater than zero');
    }
    if (requestedAmount > maxRefundable + 0.001) {
      throw new BadRequestException(
        `Refund amount exceeds the refundable balance of ${maxRefundable.toFixed(2)}`
      );
    }

    const amountPence = Math.round(requestedAmount * 100);
    let providerRefundId: string | null = null;

    if (payment.paymentChannel === 'stripe' && payment.providerPaymentId) {
      const result = await this.paymentsService.refundStripePaymentIntent(
        payment.providerPaymentId,
        amountPence,
        input.reason
      );
      providerRefundId = result.providerRefundId;
    } else if (payment.paymentChannel === 'paypal' && payment.providerPaymentId) {
      const result = await this.paymentsService.refundPayPalCapture(
        payment.providerPaymentId,
        amountPence,
        payment.currency
      );
      providerRefundId = result.providerRefundId;
    } else if (['free', 'offline', 'manual'].includes(payment.paymentChannel)) {
      // No gateway to call; just record the refund locally.
      providerRefundId = 'manual';
    } else {
      throw new BadRequestException(`Refunds are not supported for payment channel ${payment.paymentChannel}`);
    }

    const newRefundedAmount = currentRefunded + requestedAmount;
    const isFullyRefunded = newRefundedAmount >= Number(payment.grossAmount) - 0.001;

    const updated = await this.prisma.payment.update({
      where: { id: payment.id },
      data: {
        paymentStatus: isFullyRefunded ? PaymentStatus.REFUNDED : PaymentStatus.PARTIALLY_REFUNDED,
        refundedAmount: newRefundedAmount,
        refundReason: input.reason ?? null,
        refundedAt: new Date(),
        notes: payment.notes
          ? `${payment.notes}\nRefund ${isFullyRefunded ? 'full' : 'partial'}: ${requestedAmount.toFixed(2)} ${payment.currency}`
          : `Refund ${isFullyRefunded ? 'full' : 'partial'}: ${requestedAmount.toFixed(2)} ${payment.currency}`
      }
    });

    // If a ticket was fully refunded, cancel it so it cannot be used.
    if (isFullyRefunded && payment.ticket) {
      await this.prisma.ticket.update({
        where: { id: payment.ticket.id },
        data: { status: TicketStatus.CANCELLED }
      });
    }

    return {
      payment: updated,
      refundedAmount: requestedAmount,
      isFullyRefunded,
      providerRefundId
    };
  }
}
