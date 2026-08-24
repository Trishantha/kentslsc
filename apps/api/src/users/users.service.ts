import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../core/prisma/prisma.service.js';
import { UpdateUserInput, UserRole } from '@kentslsc/shared';
import { Prisma } from '@kentslsc/database';

function buildName(firstName: string | null | undefined, lastName: string | null | undefined, fallback: string) {
  const name = `${firstName ?? ''} ${lastName ?? ''}`.trim();
  return name || fallback;
}

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async findById(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id, deletedAt: null },
      select: {
        id: true,
        name: true,
        firstName: true,
        lastName: true,
        email: true,
        phone: true,
        address: true,
        role: true,
        status: true,
        createdAt: true,
        updatedAt: true
      }
    });
    if (!user) throw new NotFoundException('User not found');
    return user;
  }

  async findByIdWithDetails(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id, deletedAt: null },
      select: {
        id: true,
        name: true,
        firstName: true,
        lastName: true,
        email: true,
        phone: true,
        address: true,
        role: true,
        status: true,
        createdAt: true,
        updatedAt: true
      }
    });
    if (!user) throw new NotFoundException('User not found');

    const [memberships, tickets, listings, donations, topics, posts] = await Promise.all([
      this.prisma.membership.findMany({
        where: { userId: id, deletedAt: null },
        include: { membershipType: true },
        orderBy: { createdAt: 'desc' }
      }),
      this.prisma.ticket.findMany({
        where: { userId: id, deletedAt: null },
        include: { event: true },
        orderBy: { purchaseDatetime: 'desc' }
      }),
      this.prisma.businessListing.findMany({
        where: { ownerUserId: id, deletedAt: null },
        orderBy: { createdAt: 'desc' }
      }),
      this.prisma.donation.findMany({
        where: { userId: id, deletedAt: null },
        include: { fundraiser: true },
        orderBy: { donatedAt: 'desc' }
      }),
      this.prisma.forumTopic.findMany({
        where: { userId: id, deletedAt: null },
        orderBy: { createdAt: 'desc' }
      }),
      this.prisma.forumPost.findMany({
        where: { userId: id, deletedAt: null },
        orderBy: { createdAt: 'desc' }
      })
    ]);

    return {
      ...user,
      name: buildName(user.firstName, user.lastName, user.name),
      memberships: memberships.map((m) => ({
        ...m,
        price: Number(m.membershipType.price)
      })),
      tickets,
      listings,
      donations: donations.map((d) => ({
        ...d,
        amount: Number(d.amount)
      })),
      topics,
      posts
    };
  }

  async update(id: string, data: UpdateUserInput) {
    const updateData: Prisma.UserUpdateInput = {
      phone: data.phone,
      address: data.address ? (data.address as unknown as Prisma.InputJsonValue) : undefined
    };
    if (data.firstName || data.lastName) {
      if (data.firstName) updateData.firstName = data.firstName;
      if (data.lastName) updateData.lastName = data.lastName;
      const current = await this.prisma.user.findUnique({
        where: { id },
        select: { firstName: true, lastName: true, name: true }
      });
      const firstName = data.firstName ?? current?.firstName ?? '';
      const lastName = data.lastName ?? current?.lastName ?? '';
      const fallback = current?.name ?? '';
      updateData.name = buildName(firstName, lastName, fallback);
    }

    return this.prisma.user.update({
      where: { id },
      data: updateData,
      select: {
        id: true,
        name: true,
        firstName: true,
        lastName: true,
        email: true,
        phone: true,
        address: true,
        role: true,
        status: true,
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
      this.prisma.user.findUnique({
        where: { id },
        select: {
          id: true,
          name: true,
          firstName: true,
          lastName: true,
          email: true,
          phone: true,
          address: true,
          role: true,
          status: true,
          createdAt: true,
          updatedAt: true,
          deletedAt: true
        }
      }),
      this.prisma.membership.findMany({ where: { userId: id } }),
      this.prisma.ticket.findMany({ where: { userId: id } }),
      this.prisma.businessListing.findMany({ where: { ownerUserId: id } }),
      this.prisma.donation.findMany({ where: { userId: id } }),
      this.prisma.forumTopic.findMany({ where: { userId: id } }),
      this.prisma.forumPost.findMany({ where: { userId: id } })
    ]);
    return { user, memberships, tickets, listings, donations, topics, posts };
  }

  async listUsers(page = 1, limit = 20, role?: string, search?: string) {
    const skip = (page - 1) * limit;
    const where: {
      deletedAt: null;
      role?: UserRole;
      OR?: Array<{ name: { contains: string; mode: 'insensitive' } } | { email: { contains: string; mode: 'insensitive' } }>;
    } = { deletedAt: null };
    if (role) where.role = role as UserRole;
    if (search && search.trim()) {
      const term = search.trim();
      where.OR = [
        { name: { contains: term, mode: 'insensitive' } },
        { email: { contains: term, mode: 'insensitive' } }
      ];
    }
    const [items, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          name: true,
          firstName: true,
          lastName: true,
          email: true,
          role: true,
          status: true,
          createdAt: true
        }
      }),
      this.prisma.user.count({ where })
    ]);
    return {
      items: items.map((u) => ({
        ...u,
        name: buildName(u.firstName, u.lastName, u.name)
      })),
      total,
      page,
      limit
    };
  }

  async exportUsers(role?: string, search?: string) {
    const where: {
      deletedAt: null;
      role?: UserRole;
      OR?: Array<{ name: { contains: string; mode: 'insensitive' } } | { email: { contains: string; mode: 'insensitive' } }>;
    } = { deletedAt: null };
    if (role) where.role = role as UserRole;
    if (search && search.trim()) {
      const term = search.trim();
      where.OR = [
        { name: { contains: term, mode: 'insensitive' } },
        { email: { contains: term, mode: 'insensitive' } }
      ];
    }

    const users = await this.prisma.user.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        memberships: {
          where: { deletedAt: null },
          orderBy: { createdAt: 'desc' },
          take: 1,
          include: { membershipType: true }
        }
      }
    });

    return users.map((u) => {
      const address = u.address as
        | { buildingStreet?: string; locality?: string; townCity?: string; postcode?: string }
        | null;
      const latestMembership = u.memberships[0];
      return {
        id: u.id,
        name: buildName(u.firstName, u.lastName, u.name),
        firstName: u.firstName,
        lastName: u.lastName,
        email: u.email,
        phone: u.phone,
        role: u.role,
        status: u.status,
        emailVerifiedAt: u.emailVerifiedAt ? u.emailVerifiedAt.toISOString() : null,
        passwordChangedAt: u.passwordChangedAt ? u.passwordChangedAt.toISOString() : null,
        createdAt: u.createdAt.toISOString(),
        updatedAt: u.updatedAt.toISOString(),
        buildingStreet: address?.buildingStreet ?? '',
        locality: address?.locality ?? '',
        townCity: address?.townCity ?? '',
        postcode: address?.postcode ?? '',
        latestMembershipType: latestMembership?.membershipType?.name ?? '',
        latestMembershipStatus: latestMembership?.status ?? '',
        latestMembershipStartDate: latestMembership?.startDate
          ? latestMembership.startDate.toISOString()
          : null,
        latestMembershipEndDate: latestMembership?.endDate
          ? latestMembership.endDate.toISOString()
          : null,
        latestMembershipCardUrl: latestMembership?.membershipCardUrl ?? ''
      };
    });
  }
}
