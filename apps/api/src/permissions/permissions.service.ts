import { Injectable, NotFoundException, BadRequestException, ConflictException } from '@nestjs/common';
import { Permission, UserRole } from '@kentslsc/shared';
import { PrismaService } from '../core/prisma/prisma.service.js';
import type { Prisma } from '@kentslsc/database';

export interface RoleInput {
  name: string;
  description?: string;
  permissions: Permission[];
}

export interface BackOfficeUserInput {
  userId?: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string;
  roleId?: string;
  permissions?: Permission[];
}

@Injectable()
export class PermissionsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Return the effective permission set for a user: directly-assigned
   * permissions plus permissions inherited from their back-office role.
   * The result is deduplicated and sorted.
   */
  async getUserPermissions(userId: string): Promise<Permission[]> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId, deletedAt: null },
      select: {
        id: true,
        role: true,
        backOfficeRoleId: true,
        userPermissions: { select: { permission: true } }
      }
    });
    if (!user) return [];

    if (user.role === UserRole.ADMIN) {
      return Object.values(Permission);
    }

    const permissions = new Set<Permission>(
      user.userPermissions.map((p) => p.permission as Permission)
    );

    if (user.backOfficeRoleId) {
      const rolePermissions = await this.prisma.backOfficeRolePermission.findMany({
        where: { roleId: user.backOfficeRoleId },
        select: { permission: true }
      });
      for (const rp of rolePermissions) {
        permissions.add(rp.permission as Permission);
      }
    }

    return Array.from(permissions).sort();
  }

  /**
   * Return the user's directly-assigned permissions and their role-derived
   * permissions as two separate lists. Useful for UI editing.
   */
  async getUserPermissionDetails(userId: string): Promise<{
    roleId: string | null;
    direct: Permission[];
    inherited: Permission[];
    effective: Permission[];
  }> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId, deletedAt: null },
      select: {
        id: true,
        role: true,
        backOfficeRoleId: true,
        userPermissions: {
          select: { permission: true, sourceRoleId: true }
        }
      }
    });
    if (!user) throw new NotFoundException('User not found');

    if (user.role === UserRole.ADMIN) {
      return {
        roleId: user.backOfficeRoleId,
        direct: Object.values(Permission),
        inherited: [],
        effective: Object.values(Permission)
      };
    }

    const direct = new Set<Permission>();
    const inherited = new Set<Permission>();

    for (const up of user.userPermissions) {
      if (up.sourceRoleId) {
        inherited.add(up.permission as Permission);
      } else {
        direct.add(up.permission as Permission);
      }
    }

    if (user.backOfficeRoleId) {
      const rolePermissions = await this.prisma.backOfficeRolePermission.findMany({
        where: { roleId: user.backOfficeRoleId },
        select: { permission: true }
      });
      for (const rp of rolePermissions) {
        inherited.add(rp.permission as Permission);
      }
    }

    const effective = new Set<Permission>([...direct, ...inherited]);

    return {
      roleId: user.backOfficeRoleId,
      direct: Array.from(direct).sort(),
      inherited: Array.from(inherited).sort(),
      effective: Array.from(effective).sort()
    };
  }

  async findAllRoles() {
    return this.prisma.backOfficeRole.findMany({
      orderBy: { name: 'asc' },
      include: {
        permissions: { select: { permission: true } }
      }
    });
  }

  async findRoleById(id: string) {
    const role = await this.prisma.backOfficeRole.findUnique({
      where: { id },
      include: {
        permissions: { select: { permission: true } }
      }
    });
    if (!role) throw new NotFoundException('Role not found');
    return role;
  }

  async createRole(input: RoleInput) {
    const normalizedName = input.name.trim();
    if (!normalizedName) throw new BadRequestException('Role name is required');

    const existing = await this.prisma.backOfficeRole.findUnique({
      where: { name: normalizedName }
    });
    if (existing) throw new ConflictException('A role with this name already exists');

    const validPermissions = this.validatePermissions(input.permissions ?? []);

    return this.prisma.backOfficeRole.create({
      data: {
        name: normalizedName,
        description: input.description,
        permissions: {
          create: validPermissions.map((permission) => ({ permission }))
        }
      },
      include: {
        permissions: { select: { permission: true } }
      }
    });
  }

  async updateRole(id: string, input: Partial<RoleInput>) {
    const role = await this.prisma.backOfficeRole.findUnique({ where: { id } });
    if (!role) throw new NotFoundException('Role not found');

    const data: Prisma.BackOfficeRoleUpdateInput = {};

    if (input.name !== undefined) {
      const normalizedName = input.name.trim();
      if (!normalizedName) throw new BadRequestException('Role name is required');
      if (normalizedName !== role.name) {
        const existing = await this.prisma.backOfficeRole.findUnique({
          where: { name: normalizedName }
        });
        if (existing) throw new ConflictException('A role with this name already exists');
        data.name = normalizedName;
      }
    }

    if (input.description !== undefined) {
      data.description = input.description ?? null;
    }

    if (input.permissions !== undefined) {
      const validPermissions = this.validatePermissions(input.permissions);
      data.permissions = {
        deleteMany: {},
        create: validPermissions.map((permission) => ({ permission }))
      };
    }

    return this.prisma.backOfficeRole.update({
      where: { id },
      data,
      include: {
        permissions: { select: { permission: true } }
      }
    });
  }

  async deleteRole(id: string) {
    const role = await this.prisma.backOfficeRole.findUnique({ where: { id } });
    if (!role) throw new NotFoundException('Role not found');

    await this.prisma.$transaction([
      // Remove role-derived user permissions.
      this.prisma.userPermission.deleteMany({ where: { sourceRoleId: id } }),
      // Unassign the role from users.
      this.prisma.user.updateMany({
        where: { backOfficeRoleId: id },
        data: { backOfficeRoleId: null }
      }),
      // Delete the role (cascades to backOfficeRolePermission).
      this.prisma.backOfficeRole.delete({ where: { id } })
    ]);

    return { id, deleted: true };
  }

  async assignRoleToUser(userId: string, roleId: string | null) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId, deletedAt: null },
      select: { id: true, role: true }
    });
    if (!user) throw new NotFoundException('User not found');
    if (user.role === UserRole.ADMIN) {
      throw new BadRequestException('Cannot change role assignment for an admin user');
    }

    if (roleId) {
      const role = await this.prisma.backOfficeRole.findUnique({ where: { id: roleId } });
      if (!role) throw new NotFoundException('Role not found');
    }

    await this.prisma.$transaction(async (tx) => {
      // Remove any previously inherited permissions.
      await tx.userPermission.deleteMany({
        where: { userId, sourceRoleId: { not: null } }
      });

      // Update the user's role reference.
      await tx.user.update({
        where: { id: userId },
        data: { backOfficeRoleId: roleId }
      });

      // Re-create inherited permissions if a role is assigned.
      if (roleId) {
        const rolePermissions = await tx.backOfficeRolePermission.findMany({
          where: { roleId },
          select: { permission: true }
        });
        await tx.userPermission.createMany({
          data: rolePermissions.map((rp) => ({
            userId,
            permission: rp.permission,
            sourceRoleId: roleId
          })),
          skipDuplicates: true
        });
      }
    });

    return this.getUserPermissionDetails(userId);
  }

  async setDirectUserPermissions(userId: string, permissions: Permission[]) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId, deletedAt: null },
      select: { id: true, role: true }
    });
    if (!user) throw new NotFoundException('User not found');
    if (user.role === UserRole.ADMIN) {
      throw new BadRequestException('Admin users already have all permissions');
    }

    const validPermissions = this.validatePermissions(permissions);

    await this.prisma.$transaction(async (tx) => {
      // Remove all directly-assigned (non-inherited) permissions.
      await tx.userPermission.deleteMany({
        where: { userId, sourceRoleId: null }
      });

      // Add the new direct permissions.
      if (validPermissions.length > 0) {
        await tx.userPermission.createMany({
          data: validPermissions.map((permission) => ({
            userId,
            permission,
            sourceRoleId: null
          })),
          skipDuplicates: true
        });
      }
    });

    return this.getUserPermissionDetails(userId);
  }

  async grantDirectPermission(userId: string, permission: Permission) {
    this.validatePermission(permission);

    const user = await this.prisma.user.findUnique({
      where: { id: userId, deletedAt: null },
      select: { id: true, role: true }
    });
    if (!user) throw new NotFoundException('User not found');
    if (user.role === UserRole.ADMIN) {
      throw new BadRequestException('Admin users already have all permissions');
    }

    await this.prisma.userPermission.upsert({
      where: {
        userId_permission: { userId, permission }
      },
      create: { userId, permission, sourceRoleId: null },
      update: { sourceRoleId: null }
    });

    return this.getUserPermissionDetails(userId);
  }

  async revokeDirectPermission(userId: string, permission: Permission) {
    this.validatePermission(permission);

    const user = await this.prisma.user.findUnique({
      where: { id: userId, deletedAt: null },
      select: { id: true, role: true }
    });
    if (!user) throw new NotFoundException('User not found');
    if (user.role === UserRole.ADMIN) {
      throw new BadRequestException('Admin users already have all permissions');
    }

    // Only revoke direct permissions; inherited ones remain.
    await this.prisma.userPermission.deleteMany({
      where: { userId, permission, sourceRoleId: null }
    });

    return this.getUserPermissionDetails(userId);
  }

  /**
   * Determine whether a user holds a permission, respecting inherited roles.
   */
  async userHasPermission(userId: string, permission: Permission): Promise<boolean> {
    const perms = await this.getUserPermissions(userId);
    return perms.includes(permission);
  }

  /**
   * Recompute role-derived permissions for every user assigned to a role.
   * Called when a role's permission set is updated.
   */
  async syncRolePermissionsForUsers(roleId: string) {
    const rolePermissions = await this.prisma.backOfficeRolePermission.findMany({
      where: { roleId },
      select: { permission: true }
    });
    const permissions = rolePermissions.map((rp) => rp.permission);

    const users = await this.prisma.user.findMany({
      where: { backOfficeRoleId: roleId, deletedAt: null },
      select: { id: true }
    });

    await this.prisma.$transaction(async (tx) => {
      await tx.userPermission.deleteMany({ where: { sourceRoleId: roleId } });

      if (permissions.length > 0 && users.length > 0) {
        const bindings = users.flatMap((user) =>
          permissions.map((permission) => ({
            userId: user.id,
            permission,
            sourceRoleId: roleId
          }))
        );
        await tx.userPermission.createMany({ data: bindings, skipDuplicates: true });
      }
    });
  }

  private validatePermissions(permissions: Permission[]): Permission[] {
    const valid = Object.values(Permission);
    for (const p of permissions) {
      if (!valid.includes(p)) throw new BadRequestException(`Invalid permission: ${p}`);
    }
    return Array.from(new Set(permissions));
  }

  private validatePermission(permission: Permission) {
    const valid = Object.values(Permission);
    if (!valid.includes(permission)) throw new BadRequestException(`Invalid permission: ${permission}`);
  }
}
