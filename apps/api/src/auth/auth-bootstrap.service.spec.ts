import { jest, describe, it, expect, beforeEach } from '@jest/globals';
import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { AuthBootstrapService } from './auth-bootstrap.service.js';
import { PrismaService } from '../core/prisma/prisma.service.js';
import { UserRole } from '@kentslsc/shared';

describe('AuthBootstrapService', () => {
  let service: AuthBootstrapService;
  let prisma: PrismaService;
  let config: ConfigService;

  const mockUser = {
    id: 'admin-1',
    email: 'admin@kentslsc.org',
    role: UserRole.ADMIN
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthBootstrapService,
        {
          provide: PrismaService,
          useValue: {
            user: {
              findUnique: jest.fn() as any,
              create: jest.fn(() => Promise.resolve({ ...mockUser, id: 'new-admin' })) as any,
              update: jest.fn(() => Promise.resolve(mockUser)) as any
            },
            authEvent: {
              create: jest.fn(() => Promise.resolve({ id: 'event-1' })) as any
            },
            $transaction: jest.fn((ops: any[]) => Promise.all(ops)) as any
          } as any
        },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn() as any
          }
        }
      ]
    }).compile();

    service = module.get<AuthBootstrapService>(AuthBootstrapService);
    prisma = module.get<PrismaService>(PrismaService);
    config = module.get<ConfigService>(ConfigService);
  });

  it('should do nothing when ADMIN_EMERGENCY_PASSWORD is not set', async () => {
    jest.spyOn(config, 'get').mockReturnValue(undefined);

    await service.onModuleInit();

    expect(prisma.user.findUnique).not.toHaveBeenCalled();
  });

  it('should reset the admin password and clear lockout when emergency reset is enabled', async () => {
    jest
      .spyOn(config, 'get')
      .mockImplementation((key: string) =>
        key === 'ADMIN_EMERGENCY_PASSWORD'
          ? 'Emergency123!'
          : key === 'ADMIN_EMERGENCY_RESET_ENABLED'
            ? 'true'
            : undefined
      );
    (prisma.user.findUnique as jest.MockedFunction<any>).mockResolvedValue(mockUser);

    await service.onModuleInit();

    expect(prisma.user.findUnique).toHaveBeenCalledWith({ where: { email: 'admin@kentslsc.org' } });
    expect(prisma.user.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { email: 'admin@kentslsc.org' },
        data: expect.objectContaining({
          passwordHash: expect.any(String),
          passwordChangedAt: expect.any(Date)
        })
      })
    );
    expect(prisma.authEvent.create).toHaveBeenCalledTimes(2);
  });

  it('should not reset the admin password when emergency reset is not enabled', async () => {
    jest
      .spyOn(config, 'get')
      .mockImplementation((key: string) => (key === 'ADMIN_EMERGENCY_PASSWORD' ? 'Emergency123!' : undefined));
    (prisma.user.findUnique as jest.MockedFunction<any>).mockResolvedValue(mockUser);

    await service.onModuleInit();

    expect(prisma.user.findUnique).not.toHaveBeenCalled();
    expect(prisma.user.update).not.toHaveBeenCalled();
    expect(prisma.authEvent.create).not.toHaveBeenCalled();
  });

  it('should create an admin account when emergency email does not exist and reset is enabled', async () => {
    jest
      .spyOn(config, 'get')
      .mockImplementation((key: string) => {
        if (key === 'ADMIN_EMERGENCY_PASSWORD') return 'Emergency123!';
        if (key === 'ADMIN_EMERGENCY_RESET_ENABLED') return 'true';
        if (key === 'ADMIN_EMERGENCY_EMAIL') return 'info@kentslsc.org';
        return undefined;
      });
    (prisma.user.findUnique as jest.MockedFunction<any>).mockResolvedValue(null);

    await service.onModuleInit();

    expect(prisma.user.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          email: 'info@kentslsc.org',
          role: UserRole.ADMIN,
          emailVerifiedAt: expect.any(Date)
        })
      })
    );
    expect(prisma.authEvent.create).toHaveBeenCalledTimes(1);
  });

  it('should create the default admin account when no email is configured and reset is enabled', async () => {
    jest
      .spyOn(config, 'get')
      .mockImplementation((key: string) =>
        key === 'ADMIN_EMERGENCY_PASSWORD'
          ? 'Emergency123!'
          : key === 'ADMIN_EMERGENCY_RESET_ENABLED'
            ? 'true'
            : undefined
      );
    (prisma.user.findUnique as jest.MockedFunction<any>).mockResolvedValue(null);

    await service.onModuleInit();

    expect(prisma.user.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ email: 'admin@kentslsc.org', role: UserRole.ADMIN })
      })
    );
  });

  it('should warn when the target user is not an admin', async () => {
    jest
      .spyOn(config, 'get')
      .mockImplementation((key: string) =>
        key === 'ADMIN_EMERGENCY_PASSWORD'
          ? 'Emergency123!'
          : key === 'ADMIN_EMERGENCY_RESET_ENABLED'
            ? 'true'
            : undefined
      );
    (prisma.user.findUnique as jest.MockedFunction<any>).mockResolvedValue({
      ...mockUser,
      role: UserRole.MEMBER
    });

    await service.onModuleInit();

    expect(prisma.user.update).not.toHaveBeenCalled();
  });
});
