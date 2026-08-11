import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { randomBytes } from 'crypto';
import { AuthEventType } from '@kentslsc/database';
import { UserRole } from '@kentslsc/shared';
import { PrismaService } from '../core/prisma/prisma.service.js';
import { EmailService } from '../email/email.service.js';
import { CredentialsService } from '../auth/credentials.service.js';
import { SessionsService, type RequestContext } from '../auth/sessions.service.js';
import type { AdminCreateUserDto } from './dto/admin-user.dto.js';

@Injectable()
export class AdminUsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly email: EmailService,
    private readonly credentials: CredentialsService,
    private readonly sessions: SessionsService
  ) {}

  /**
   * Create a user as an administrator.
   *
   * Critically, this issues NO cookies. Before this existed the only way to
   * create an account was the public registration endpoint, which set auth
   * cookies unconditionally — so an admin creating an account for someone else
   * got logged out of their own and into the new one.
   */
  async createUser(actor: { sub: string }, dto: AdminCreateUserDto, ctx: RequestContext = {}) {
    const email = dto.email.toLowerCase().trim();

    const existing = await this.prisma.user.findUnique({ where: { email } });
    if (existing) {
      throw new ConflictException('A user with that email already exists');
    }

    // With sendInvite the admin never sees a password: a random one is stored
    // and immediately superseded by whatever the user chooses via the link.
    const rawPassword = dto.sendInvite
      ? randomBytes(32).toString('base64url')
      : dto.password;

    if (!rawPassword) {
      throw new BadRequestException('Provide a password or set sendInvite');
    }

    const user = await this.prisma.user.create({
      data: {
        name: `${dto.firstName} ${dto.lastName}`.trim(),
        firstName: dto.firstName,
        lastName: dto.lastName,
        email,
        phone: dto.phone,
        role: dto.role,
        passwordHash: await bcrypt.hash(rawPassword, 12),
        emailVerifiedAt: dto.markEmailVerified === false ? null : new Date()
      },
      select: { id: true, name: true, email: true, role: true, createdAt: true }
    });

    if (dto.sendInvite) {
      const link = await this.credentials.createSetPasswordLink(user.id);
      await this.email.sendAdminCreatedAccount(user.email, dto.firstName, link).catch(() => undefined);
    }

    await this.sessions.recordEvent({
      userId: user.id,
      email: user.email,
      type: AuthEventType.ADMIN_USER_CREATED,
      ctx,
      metadata: { createdBy: actor.sub, role: dto.role, invited: Boolean(dto.sendInvite) }
    });

    return user;
  }

  async updateRole(
    actor: { sub: string },
    targetUserId: string,
    role: UserRole,
    ctx: RequestContext = {}
  ) {
    const target = await this.prisma.user.findUnique({
      where: { id: targetUserId },
      select: { id: true, email: true, role: true, deletedAt: true }
    });
    if (!target || target.deletedAt) throw new NotFoundException('User not found');

    // Changing your own role is how an admin accidentally locks themselves out.
    if (target.id === actor.sub) {
      throw new BadRequestException('You cannot change your own role');
    }

    // Never leave the system with no administrator.
    if (target.role === UserRole.ADMIN && role !== UserRole.ADMIN) {
      const admins = await this.prisma.user.count({
        where: { role: UserRole.ADMIN, deletedAt: null }
      });
      if (admins <= 1) {
        throw new BadRequestException('Cannot demote the last remaining administrator');
      }
    }

    if (target.role === role) return { id: target.id, role };

    const updated = await this.prisma.user.update({
      where: { id: targetUserId },
      data: { role },
      select: { id: true, email: true, role: true }
    });

    // A privilege change must not wait for the old token to expire. JwtStrategy
    // re-reads the role per request so it applies immediately anyway, but
    // revoking makes the boundary explicit and forces a clean re-login.
    await this.sessions.revokeAllForUser(targetUserId, 'role_changed');

    await this.sessions.recordEvent({
      userId: targetUserId,
      email: target.email,
      type: AuthEventType.ROLE_CHANGED,
      ctx,
      metadata: { changedBy: actor.sub, from: target.role, to: role }
    });

    return updated;
  }

  async forceLogout(targetUserId: string, ctx: RequestContext = {}) {
    const target = await this.prisma.user.findUnique({
      where: { id: targetUserId },
      select: { id: true, email: true }
    });
    if (!target) throw new NotFoundException('User not found');

    const revoked = await this.sessions.revokeAllForUser(targetUserId, 'admin_force_logout');
    await this.sessions.recordEvent({
      userId: targetUserId,
      email: target.email,
      type: AuthEventType.SESSION_REVOKED,
      ctx,
      metadata: { revoked, reason: 'admin_force_logout' }
    });

    return { success: true, revoked };
  }
}
