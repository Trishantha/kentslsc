import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../core/prisma/prisma.service.js';
import { UpdateUserInput, UserRole } from '@kentslsc/shared';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async findById(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id, deletedAt: null },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        address: true,
        role: true,
        createdAt: true,
        updatedAt: true
      }
    });
    if (!user) throw new NotFoundException('User not found');
    return user;
  }

  async update(id: string, data: UpdateUserInput) {
    return this.prisma.user.update({
      where: { id },
      data: {
        name: data.name,
        phone: data.phone,
        address: data.address
      },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        address: true,
        role: true,
        updatedAt: true
      }
    });
  }

  async softDelete(id: string) {
    return this.prisma.user.update({
      where: { id },
      data: { deletedAt: new Date(), refreshToken: null }
    });
  }

  async exportData(id: string) {
    const [user, memberships, tickets, listings, donations, topics, posts] = await Promise.all([
      this.prisma.user.findUnique({ where: { id } }),
      this.prisma.membership.findMany({ where: { userId: id } }),
      this.prisma.ticket.findMany({ where: { userId: id } }),
      this.prisma.businessListing.findMany({ where: { ownerUserId: id } }),
      this.prisma.donation.findMany({ where: { userId: id } }),
      this.prisma.forumTopic.findMany({ where: { userId: id } }),
      this.prisma.forumPost.findMany({ where: { userId: id } })
    ]);
    return { user, memberships, tickets, listings, donations, topics, posts };
  }

  async listUsers(page = 1, limit = 20, role?: string) {
    const skip = (page - 1) * limit;
    const where: { deletedAt: null; role?: UserRole } = { deletedAt: null };
    if (role) where.role = role as UserRole;
    const [items, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        select: { id: true, name: true, email: true, role: true, createdAt: true }
      }),
      this.prisma.user.count({ where })
    ]);
    return { items, total, page, limit };
  }
}
