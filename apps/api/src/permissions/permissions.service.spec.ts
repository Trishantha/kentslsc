import { jest, describe, it, expect, beforeEach } from '@jest/globals';
import { Test, TestingModule } from '@nestjs/testing';
import { Permission, UserRole } from '@kentslsc/shared';
import { PermissionsService } from './permissions.service.js';
import { PrismaService } from '../core/prisma/prisma.service.js';

describe('PermissionsService', () => {
  let service: PermissionsService;
  let prisma: PrismaService;

  const mockUser = {
    id: 'user-1',
    role: UserRole.MEMBER,
    backOfficeRoleId: null,
    userPermissions: [] as { permission: Permission }[]
  };

  beforeEach(async () => {
    const txMocks = {
      userPermission: {
        findMany: jest.fn() as any,
        createMany: jest.fn() as any,
        create: jest.fn() as any,
        upsert: jest.fn() as any,
        deleteMany: jest.fn() as any,
        delete: jest.fn() as any
      },
      user: {
        findUnique: jest.fn() as any,
        findMany: jest.fn() as any,
        update: jest.fn() as any,
        updateMany: jest.fn() as any,
        create: jest.fn() as any,
        count: jest.fn() as any
      },
      backOfficeRolePermission: {
        findMany: jest.fn() as any,
        createMany: jest.fn() as any,
        deleteMany: jest.fn() as any
      }
    };

    const basePrisma = {
      user: {
        findUnique: jest.fn() as any,
        findMany: jest.fn() as any,
        update: jest.fn() as any,
        updateMany: jest.fn() as any,
        create: jest.fn() as any,
        count: jest.fn() as any
      },
      backOfficeRole: {
        findUnique: jest.fn() as any,
        findMany: jest.fn() as any,
        create: jest.fn() as any,
        update: jest.fn() as any,
        delete: jest.fn() as any
      },
      backOfficeRolePermission: {
        findMany: jest.fn() as any,
        createMany: jest.fn() as any,
        deleteMany: jest.fn() as any
      },
      userPermission: {
        findMany: jest.fn() as any,
        createMany: jest.fn() as any,
        create: jest.fn() as any,
        upsert: jest.fn() as any,
        deleteMany: jest.fn() as any,
        delete: jest.fn() as any
      },
      $transaction: jest.fn((cb: any) =>
        typeof cb === 'function' ? cb(txMocks) : Promise.resolve()
      ) as any
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PermissionsService,
        {
          provide: PrismaService,
          useValue: basePrisma
        }
      ]
    }).compile();

    service = module.get<PermissionsService>(PermissionsService);
    prisma = module.get<PrismaService>(PrismaService);
    // Expose tx mocks for assertions in tests
    (service as any).txMocks = txMocks;
  });

  describe('getUserPermissions', () => {
    it('returns all permissions for an admin', async () => {
      (prisma.user.findUnique as any).mockResolvedValue({ ...mockUser, role: UserRole.ADMIN });
      const perms = await service.getUserPermissions('user-1');
      expect(perms).toEqual(expect.arrayContaining(Object.values(Permission)));
    });

    it('returns direct permissions for a non-admin user', async () => {
      (prisma.user.findUnique as any).mockResolvedValue({
        ...mockUser,
        userPermissions: [{ permission: Permission.MANAGE_EVENTS }]
      });
      const perms = await service.getUserPermissions('user-1');
      expect(perms).toEqual([Permission.MANAGE_EVENTS]);
    });

    it('merges role-derived permissions with direct permissions', async () => {
      (prisma.user.findUnique as any).mockResolvedValue({
        ...mockUser,
        backOfficeRoleId: 'role-1',
        userPermissions: [{ permission: Permission.MANAGE_BLOG }]
      });
      (prisma.backOfficeRolePermission.findMany as any).mockResolvedValue([
        { permission: Permission.MANAGE_EVENTS }
      ]);

      const perms = await service.getUserPermissions('user-1');
      expect(perms).toContain(Permission.MANAGE_BLOG);
      expect(perms).toContain(Permission.MANAGE_EVENTS);
    });

    it('returns empty array when user is not found', async () => {
      (prisma.user.findUnique as any).mockResolvedValue(null);
      const perms = await service.getUserPermissions('missing');
      expect(perms).toEqual([]);
    });
  });

  describe('createRole', () => {
    it('creates a role with the given permissions', async () => {
      (prisma.backOfficeRole.findUnique as any).mockResolvedValue(null);
      (prisma.backOfficeRole.create as any).mockResolvedValue({
        id: 'role-1',
        name: 'Events Manager',
        description: 'Manages events',
        permissions: [{ permission: Permission.MANAGE_EVENTS }]
      });

      const role = await service.createRole({
        name: 'Events Manager',
        description: 'Manages events',
        permissions: [Permission.MANAGE_EVENTS]
      });

      expect(role.name).toBe('Events Manager');
      expect(prisma.backOfficeRole.create).toHaveBeenCalled();
    });

    it('throws when role name already exists', async () => {
      (prisma.backOfficeRole.findUnique as any).mockResolvedValue({ id: 'role-1', name: 'Events Manager' });

      await expect(
        service.createRole({
          name: 'Events Manager',
          permissions: [Permission.MANAGE_EVENTS]
        })
      ).rejects.toThrow('already exists');
    });
  });

  describe('assignRoleToUser', () => {
    it('assigns a role and creates inherited permissions', async () => {
      (prisma.user.findUnique as any).mockResolvedValue(mockUser);
      (prisma.backOfficeRole.findUnique as any).mockResolvedValue({ id: 'role-1' });
      (prisma.backOfficeRolePermission.findMany as any).mockResolvedValue([
        { permission: Permission.MANAGE_EVENTS }
      ]);

      const txMocks = (service as any).txMocks;
      txMocks.backOfficeRolePermission.findMany.mockResolvedValue([
        { permission: Permission.MANAGE_EVENTS }
      ]);
      txMocks.userPermission.createMany.mockResolvedValue(undefined);

      jest.spyOn(service as any, 'getUserPermissionDetails').mockResolvedValue({
        roleId: 'role-1',
        direct: [],
        inherited: [Permission.MANAGE_EVENTS],
        effective: [Permission.MANAGE_EVENTS]
      });

      const result = await service.assignRoleToUser('user-1', 'role-1');
      expect(result.roleId).toBe('role-1');
      expect(result.inherited).toContain(Permission.MANAGE_EVENTS);
    });
  });

  describe('setDirectUserPermissions', () => {
    it('replaces direct permissions for a user', async () => {
      (prisma.user.findUnique as any).mockResolvedValue(mockUser);

      jest.spyOn(service as any, 'getUserPermissionDetails').mockResolvedValue({
        roleId: null,
        direct: [Permission.MANAGE_BLOG],
        inherited: [],
        effective: [Permission.MANAGE_BLOG]
      });

      const result = await service.setDirectUserPermissions('user-1', [Permission.MANAGE_BLOG]);
      expect(result.direct).toEqual([Permission.MANAGE_BLOG]);
    });

    it('throws when target user is an admin', async () => {
      (prisma.user.findUnique as any).mockResolvedValue({ ...mockUser, role: UserRole.ADMIN });

      await expect(
        service.setDirectUserPermissions('user-1', [Permission.MANAGE_BLOG])
      ).rejects.toThrow('Admin users already have all permissions');
    });
  });

  describe('deleteRole', () => {
    it('removes role, inherited permissions and user assignments', async () => {
      (prisma.backOfficeRole.findUnique as any).mockResolvedValue({ id: 'role-1' });

      const result = await service.deleteRole('role-1');
      expect(result).toEqual({ id: 'role-1', deleted: true });
      expect(prisma.$transaction).toHaveBeenCalled();
    });
  });
});
