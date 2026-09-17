import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException
} from '@nestjs/common';
import { AuthEventType } from '@kentslsc/database';
import { UserRole, Permission, UserStatus, permissionLabels } from '@kentslsc/shared';
import { PrismaService } from '../core/prisma/prisma.service.js';
import { EmailService } from '../email/email.service.js';
import { CredentialsService } from '../auth/credentials.service.js';
import { SessionsService, type RequestContext } from '../auth/sessions.service.js';
import { PermissionsService, type RoleInput } from '../permissions/permissions.service.js';
import { generateToken, hashPassword } from '../common/utils/crypto.js';
import type { AdminCreateUserDto } from './dto/admin-user.dto.js';
import type {
  AddExistingBackOfficeUserDto,
  InviteBackOfficeUserDto
} from './dto/back-office-user.dto.js';

@Injectable()
export class AdminUsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly email: EmailService,
    private readonly credentials: CredentialsService,
    private readonly sessions: SessionsService,
    private readonly permissionsService: PermissionsService
  ) {}

  /**
   * Create a user as an administrator.
   *
   * Critically, this issues NO cookies. Before this existed the only way to
   * create an account was the public registration endpoint, which set auth
   * cookies unconditionally — so an admin creating an account for someone else
   * got logged out of their own and into the new one.
   */
  async createUser(actor: { sub: string; role: UserRole }, dto: AdminCreateUserDto, ctx: RequestContext = {}) {
    if (dto.role === UserRole.ADMIN && actor.role !== UserRole.ADMIN) {
      throw new ForbiddenException('Only admins can create admin accounts.');
    }

    const email = dto.email.toLowerCase().trim();

    const existing = await this.prisma.user.findUnique({ where: { email } });
    if (existing) {
      throw new ConflictException('A user with that email already exists');
    }

    // With sendInvite the admin never sees a password: a random one is stored
    // and immediately superseded by whatever the user chooses via the link.
    const rawPassword = dto.sendInvite
      ? generateToken()
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
        passwordHash: await hashPassword(rawPassword),
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
      where: { id: targetUserId, deletedAt: null },
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
      select: { id: true, email: true, role: true, status: true }
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

  async updateStatus(
    actor: { sub: string },
    targetUserId: string,
    status: UserStatus,
    ctx: RequestContext = {}
  ) {
    if (targetUserId === actor.sub) {
      throw new BadRequestException('You cannot change your own status');
    }

    const target = await this.prisma.user.findUnique({
      where: { id: targetUserId, deletedAt: null },
      select: { id: true, email: true, status: true, role: true }
    });
    if (!target) throw new NotFoundException('User not found');

    if (target.status === status) return { id: target.id, status };

    // Prevent banning the last admin (same safeguard as role change).
    if (target.role === UserRole.ADMIN && status === UserStatus.BANNED) {
      const admins = await this.prisma.user.count({
        where: { role: UserRole.ADMIN, deletedAt: null, status: UserStatus.ACTIVE }
      });
      if (admins <= 1) {
        throw new BadRequestException('Cannot ban the last remaining active administrator');
      }
    }

    const updated = await this.prisma.user.update({
      where: { id: targetUserId },
      data: { status },
      select: { id: true, email: true, role: true, status: true }
    });

    // Banning a user must end all sessions immediately.
    if (status === UserStatus.BANNED) {
      await this.sessions.revokeAllForUser(targetUserId, 'banned');
    }

    await this.sessions.recordEvent({
      userId: targetUserId,
      email: target.email,
      type: AuthEventType.USER_STATUS_CHANGED,
      ctx,
      metadata: { changedBy: actor.sub, from: target.status, to: status }
    });

    return updated;
  }

  async forceLogout(actor: { sub: string; role: UserRole }, targetUserId: string, ctx: RequestContext = {}) {
    const target = await this.prisma.user.findUnique({
      where: { id: targetUserId },
      select: { id: true, email: true, role: true }
    });
    if (!target) throw new NotFoundException('User not found');
    if (target.role === UserRole.ADMIN && actor.role !== UserRole.ADMIN) {
      throw new ForbiddenException('Only admins can force-logout admin users.');
    }

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

  // ---------------------------------------------------------------------------
  // Permission & role management
  // ---------------------------------------------------------------------------

  listPermissionDefinitions() {
    return Object.entries(permissionLabels).map(([key, value]) => ({
      permission: key,
      ...value
    }));
  }

  listRoles() {
    return this.permissionsService.findAllRoles();
  }

  createRole(input: RoleInput) {
    return this.permissionsService.createRole(input);
  }

  findRole(id: string) {
    return this.permissionsService.findRoleById(id);
  }

  async updateBackOfficeRole(id: string, input: Partial<RoleInput>) {
    const role = await this.permissionsService.updateRole(id, input);
    await this.permissionsService.syncRolePermissionsForUsers(id);
    return role;
  }

  deleteRole(id: string) {
    return this.permissionsService.deleteRole(id);
  }

  getUserPermissions(userId: string) {
    return this.permissionsService.getUserPermissionDetails(userId);
  }

  setDirectPermissions(userId: string, permissions: Permission[]) {
    return this.permissionsService.setDirectUserPermissions(userId, permissions);
  }

  grantPermission(userId: string, permission: Permission) {
    return this.permissionsService.grantDirectPermission(userId, permission);
  }

  revokePermission(userId: string, permission: Permission) {
    return this.permissionsService.revokeDirectPermission(userId, permission);
  }

  assignRole(userId: string, roleId: string | null) {
    return this.permissionsService.assignRoleToUser(userId, roleId);
  }

  // ---------------------------------------------------------------------------
  // Back-office user onboarding
  // ---------------------------------------------------------------------------

  async addExistingBackOfficeUser(
    actor: { sub: string },
    dto: AddExistingBackOfficeUserDto,
    ctx: RequestContext = {}
  ) {
    const user = await this.prisma.user.findUnique({
      where: { id: dto.userId, deletedAt: null },
      select: { id: true, email: true, firstName: true, role: true }
    });
    if (!user) throw new NotFoundException('User not found');
    if (user.role === UserRole.ADMIN) {
      throw new BadRequestException('Admin users already have full back-office access');
    }

    if (dto.roleId) {
      await this.permissionsService.assignRoleToUser(user.id, dto.roleId);
    }

    if (dto.permissions && dto.permissions.length > 0) {
      await this.permissionsService.setDirectUserPermissions(user.id, dto.permissions);
    }

    // If the user has no usable password or explicit invite, send a set-password link.
    if (dto.sendInvite) {
      const link = await this.credentials.createSetPasswordLink(user.id);
      await this.email
        .sendAdminCreatedAccount(user.email, user.firstName ?? '', link)
        .catch(() => undefined);
    }

    await this.sessions.recordEvent({
      userId: user.id,
      email: user.email,
      type: AuthEventType.ADMIN_USER_CREATED,
      ctx,
      metadata: {
        createdBy: actor.sub,
        invited: Boolean(dto.sendInvite),
        source: 'existing_user',
        roleId: dto.roleId
      }
    });

    return this.permissionsService.getUserPermissionDetails(user.id);
  }

  async inviteBackOfficeUser(
    actor: { sub: string },
    dto: InviteBackOfficeUserDto,
    ctx: RequestContext = {}
  ) {
    const email = dto.email.toLowerCase().trim();

    const existing = await this.prisma.user.findUnique({ where: { email } });
    if (existing) {
      throw new ConflictException('A user with that email already exists');
    }

    const rawPassword = dto.sendInvite
      ? generateToken()
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
        role: UserRole.MEMBER,
        passwordHash: await hashPassword(rawPassword),
        emailVerifiedAt: new Date()
      },
      select: { id: true, name: true, email: true, role: true, createdAt: true }
    });

    if (dto.roleId) {
      await this.permissionsService.assignRoleToUser(user.id, dto.roleId);
    }

    if (dto.permissions && dto.permissions.length > 0) {
      await this.permissionsService.setDirectUserPermissions(user.id, dto.permissions);
    }

    if (dto.sendInvite) {
      const link = await this.credentials.createSetPasswordLink(user.id);
      await this.email.sendAdminCreatedAccount(user.email, dto.firstName, link).catch(() => undefined);
    }

    await this.sessions.recordEvent({
      userId: user.id,
      email: user.email,
      type: AuthEventType.ADMIN_USER_CREATED,
      ctx,
      metadata: {
        createdBy: actor.sub,
        role: UserRole.MEMBER,
        invited: Boolean(dto.sendInvite),
        source: 'invite',
        roleId: dto.roleId
      }
    });

    return user;
  }
}
