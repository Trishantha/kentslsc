import { Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type Stripe from 'stripe';
import { PrismaService } from '../core/prisma/prisma.service.js';
import { AiService } from '../ai/ai.service.js';
import { PaymentsService } from '../payments/payments.service.js';
import type { FundraiserInput } from '@kentslsc/shared';

@Injectable()
export class FundraisingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ai: AiService,
    private readonly payments: PaymentsService,
    private readonly configService: ConfigService
  ) {}

  async listActive() {
    const now = new Date();
    const items = await this.prisma.fundraiser.findMany({
      where: {
        isActive: true,
        deletedAt: null,
        startDate: { lte: now },
        endDate: { gte: now }
      },
      orderBy: { createdAt: 'desc' }
    });
    return items.map((item) => this.toResponse(item));
  }

  async listAll() {
    const items = await this.prisma.fundraiser.findMany({
      where: { deletedAt: null },
      orderBy: { createdAt: 'desc' },
      include: { donations: { orderBy: { donatedAt: 'desc' } } }
    });
    return items.map((item) => this.toResponse(item));
  }

  async findById(id: string) {
    const item = await this.prisma.fundraiser.findUnique({
      where: { id, deletedAt: null },
      include: { donations: { orderBy: { donatedAt: 'desc' } } }
    });
    if (!item) throw new NotFoundException('Fundraiser not found');
    return this.toResponse(item);
  }

  async create(data: FundraiserInput) {
    const aiSummary = data.description
      ? await this.ai.summarise(data.description, 'fundraiser', 200)
      : null;
    const item = await this.prisma.fundraiser.create({
      data: {
        title: data.title,
        description: data.description,
        targetAmount: data.targetAmount,
        imageUrl: data.imageUrl,
        startDate: data.startDate ?? new Date(),
        endDate: data.endDate ?? new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        isActive: data.isActive ?? true,
        aiSummary
      }
    });
    return this.toResponse(item);
  }

  async update(id: string, data: Partial<FundraiserInput>) {
    await this.findById(id);
    const aiSummary =
      data.description !== undefined
        ? await this.ai.summarise(data.description, 'fundraiser', 200)
        : undefined;
    const item = await this.prisma.fundraiser.update({
      where: { id },
      data: {
        ...(data.title !== undefined && { title: data.title }),
        ...(data.description !== undefined && { description: data.description }),
        ...(data.targetAmount !== undefined && { targetAmount: data.targetAmount }),
        ...(data.imageUrl !== undefined && { imageUrl: data.imageUrl }),
        ...(data.startDate !== undefined && { startDate: data.startDate }),
        ...(data.endDate !== undefined && { endDate: data.endDate }),
        ...(data.isActive !== undefined && { isActive: data.isActive }),
        ...(aiSummary !== undefined && { aiSummary })
      }
    });
    return this.toResponse(item);
  }

  async remove(id: string) {
    await this.findById(id);
    await this.prisma.fundraiser.update({ where: { id }, data: { deletedAt: new Date() } });
    return { id, deleted: true };
  }

  async createDonationSession(fundraiserId: string, amount: number, userId?: string) {
    const fundraiser = await this.prisma.fundraiser.findUnique({
      where: { id: fundraiserId, deletedAt: null }
    });
    if (!fundraiser) throw new NotFoundException('Fundraiser not found');

    const baseUrl = this.configService.get('FRONTEND_URL') ?? 'http://localhost:3000';
    const session = await this.payments.createCheckoutSession({
      mode: 'payment',
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: {
            currency: 'gbp',
            product_data: { name: `Donation to ${fundraiser.title}` },
            unit_amount: Math.round(amount * 100)
          },
          quantity: 1
        }
      ],
      success_url: `${baseUrl}/fundraisers/${fundraiserId}?success=1`,
      cancel_url: `${baseUrl}/fundraisers/${fundraiserId}?canceled=1`,
      metadata: {
        type: 'donation',
        fundraiserId,
        ...(userId && { userId })
      }
    });
    return { sessionId: session.id, url: session.url };
  }

  async handleCheckoutCompleted(session: Stripe.Checkout.Session) {
    const fundraiserId = session.metadata?.fundraiserId;
    const userId = session.metadata?.userId;
    if (!fundraiserId) return;

    const amount = (session.amount_total ?? 0) / 100;
    if (amount <= 0) return;

    await this.prisma.$transaction(async (tx) => {
      await tx.donation.create({
        data: {
          fundraiserId,
          userId: userId || null,
          amount,
          paymentId: session.payment_intent as string | null
        }
      });
      await tx.fundraiser.update({
        where: { id: fundraiserId },
        data: { raisedAmount: { increment: amount } }
      });
    });
  }

  private toResponse(item: any) {
    return {
      ...item,
      targetAmount: Number(item.targetAmount),
      raisedAmount: Number(item.raisedAmount),
      donations: item.donations
        ? item.donations.map((d: any) => ({
            ...d,
            amount: Number(d.amount)
          }))
        : undefined
    };
  }
}
