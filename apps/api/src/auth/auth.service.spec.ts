import { jest, describe, it, expect, beforeEach } from '@jest/globals';
import { Test, TestingModule } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { UnauthorizedException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { AuthService } from './auth.service.js';
import { SessionsService } from './sessions.service.js';
import { LoginLockoutService } from './login-lockout.service.js';
import { PrismaService } from '../core/prisma/prisma.service.js';
import { EmailService } from '../email/email.service.js';
import { MembershipsService } from '../memberships/memberships.service.js';
import { MembershipFeaturesService } from '../memberships/membership-features.service.js';
import { UserRole } from '@kentslsc/shared';

const PASSWORD = 'Str0ngPassw0rd!x';

const mockUser = {
  id: '1',
  email: 'test@kentslsc.org',
  name: 'Test User',
  firstName: 'Test',
  lastName: 'User',
  role: UserRole.MEMBER,
  passwordHash: bcrypt.hashSync(PASSWORD, 4),
  deletedAt: null
};

describe('AuthService', () => {
  let service: AuthService;
  let prisma: PrismaService;
  let sessions: SessionsService;
  let lockout: LoginLockoutService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        {
          provide: PrismaService,
          useValue: {
            user: {
              findUnique: jest.fn() as any,
              create: (jest.fn() as any).mockResolvedValue(mockUser),
              update: jest.fn() as any
            }
          } as any
        },
        {
          provide: JwtService,
          useValue: {
            signAsync: (jest.fn() as any).mockResolvedValue('token'),
            verifyAsync: (jest.fn() as any).mockResolvedValue({ sub: mockUser.id, typ: 'refresh' })
          } as any
        },
        {
          provide: ConfigService,
          useValue: {
            getOrThrow: jest.fn((key: string) => (key.includes('SECRET') ? 'secret' : undefined)) as any,
            get: jest.fn((key: string) => (key.includes('EXPIRY') ? '15m' : undefined)) as any
          } as any
        },
        {
          provide: SessionsService,
          useValue: {
            newSessionId: (jest.fn() as any).mockReturnValue('session-1'),
            create: jest.fn() as any,
            rotate: jest.fn() as any,
            recordRotation: jest.fn() as any,
            revoke: jest.fn() as any,
            revokeAllForUser: (jest.fn() as any).mockResolvedValue(0),
            recordEvent: jest.fn() as any
          } as any
        },
        {
          provide: LoginLockoutService,
          useValue: {
            lockedFor: (jest.fn() as any).mockResolvedValue(0),
            recordFailure: (jest.fn() as any).mockResolvedValue(null),
            clear: jest.fn() as any
          } as any
        },
        {
          provide: EmailService,
          useValue: { sendAccountLocked: (jest.fn() as any).mockResolvedValue(undefined) } as any
        },
        {
          provide: MembershipsService,
          useValue: { processApplication: jest.fn() as any } as any
        },
        {
          provide: MembershipFeaturesService,
          useValue: { userActiveFeatures: jest.fn() as any } as any
        }
      ]
    }).compile();

    service = module.get<AuthService>(AuthService);
    prisma = module.get<PrismaService>(PrismaService);
    sessions = module.get<SessionsService>(SessionsService);
    lockout = module.get<LoginLockoutService>(LoginLockoutService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('register', () => {
    it('creates the user without issuing any tokens', async () => {
      (prisma.user.findUnique as any).mockResolvedValue(null);

      const result = await service.register({
        firstName: 'Test',
        lastName: 'User',
        email: 'test@kentslsc.org',
        password: PASSWORD
      } as any);

      expect(result.user.email).toBe(mockUser.email);
      // The core regression: registration must never mint a session, or an
      // admin submitting the signup form is swapped into the new account.
      expect(result).not.toHaveProperty('accessToken');
      expect(result).not.toHaveProperty('refreshToken');
      expect(sessions.create).not.toHaveBeenCalled();
    });

    it('rejects a duplicate email', async () => {
      (prisma.user.findUnique as any).mockResolvedValue(mockUser);
      await expect(
        service.register({
          firstName: 'Test',
          lastName: 'User',
          email: 'test@kentslsc.org',
          password: PASSWORD
        } as any)
      ).rejects.toThrow();
    });
  });

  describe('login', () => {
    it('throws for an unknown account', async () => {
      (prisma.user.findUnique as any).mockResolvedValue(null);
      await expect(service.login({ email: 'x@y.com', password: 'wrong' })).rejects.toThrow(
        UnauthorizedException
      );
    });

    it('does not answer faster for an unknown account than for a wrong password', async () => {
      // Skipping bcrypt when the account is missing makes that response
      // measurably faster, which turns login into an enumeration oracle.
      // bcrypt is a native binding so it cannot be spied on; instead assert the
      // unknown-account path still pays the hashing cost.
      (prisma.user.findUnique as any).mockResolvedValue(null);

      const started = Date.now();
      await expect(service.login({ email: 'nobody@y.com', password: 'wrong' })).rejects.toThrow();
      const elapsed = Date.now() - started;

      // A skipped compare returns in ~0ms; a real cost-12 compare takes ~300ms.
      expect(elapsed).toBeGreaterThan(50);
    });

    it('gives the same error for an unknown account and a wrong password', async () => {
      (prisma.user.findUnique as any).mockResolvedValue(null);
      const unknown = await service.login({ email: 'nobody@y.com', password: 'x' }).catch((e) => e);

      (prisma.user.findUnique as any).mockResolvedValue(mockUser);
      const wrong = await service.login({ email: mockUser.email, password: 'x' }).catch((e) => e);

      expect(unknown.message).toBe(wrong.message);
      expect(unknown.getStatus()).toBe(wrong.getStatus());
    });

    it('records the failure so repeated attempts can trip the lockout', async () => {
      (prisma.user.findUnique as any).mockResolvedValue(mockUser);
      await expect(
        service.login({ email: mockUser.email, password: 'wrong-password' })
      ).rejects.toThrow(UnauthorizedException);
      expect(lockout.recordFailure).toHaveBeenCalled();
    });

    it('rejects a locked account even with the correct password', async () => {
      (prisma.user.findUnique as any).mockResolvedValue(mockUser);
      (lockout.lockedFor as any).mockResolvedValue(900);

      await expect(service.login({ email: mockUser.email, password: PASSWORD })).rejects.toThrow(
        UnauthorizedException
      );
      expect(sessions.create).not.toHaveBeenCalled();
    });

    it('issues a session and clears the lockout on success', async () => {
      (prisma.user.findUnique as any).mockResolvedValue(mockUser);

      const tokens = await service.login({ email: mockUser.email, password: PASSWORD });

      expect(tokens).toHaveProperty('accessToken');
      expect(tokens).toHaveProperty('refreshToken');
      expect(sessions.create).toHaveBeenCalled();
      expect(lockout.clear).toHaveBeenCalledWith(mockUser.email);
    });
  });

  describe('refresh', () => {
    it('rejects a token whose session cannot be rotated', async () => {
      // rotate() returns null both for an unknown token and for a replayed one.
      (sessions.rotate as any).mockResolvedValue(null);
      await expect(service.refresh('some-token')).rejects.toThrow(UnauthorizedException);
    });
  });
});
