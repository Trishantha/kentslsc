import { jest, describe, it, expect, beforeEach } from '@jest/globals';
import { Test, TestingModule } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { UnauthorizedException } from '@nestjs/common';
import { AuthService } from './auth.service.js';
import { PrismaService } from '../core/prisma/prisma.service.js';
import { RedisService } from '../core/redis/redis.service.js';
import { UserRole } from '@kentslsc/shared';

const mockUser = {
  id: '1',
  email: 'test@kentslsc.org',
  name: 'Test User',
  role: UserRole.MEMBER,
  passwordHash: '$2b$12$abcdefghijklmnopqrstuvwx1234567890abcdefg',
  deletedAt: null
};

describe('AuthService', () => {
  let service: AuthService;
  let prisma: PrismaService;

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
            verifyAsync: (jest.fn() as any).mockResolvedValue({ sub: mockUser.id })
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
          provide: RedisService,
          useValue: {
            set: jest.fn() as any,
            del: jest.fn() as any,
            get: jest.fn() as any
          } as any
        }
      ]
    }).compile();

    service = module.get<AuthService>(AuthService);
    prisma = module.get<PrismaService>(PrismaService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should register a user', async () => {
    (prisma.user.findUnique as any).mockResolvedValue(null);
    const result = await service.register({
      name: 'Test User',
      email: 'test@kentslsc.org',
      password: 'password123'
    } as any);
    expect(result).toHaveProperty('accessToken');
    expect(result).toHaveProperty('refreshToken');
  });

  it('should throw on login for invalid credentials', async () => {
    (prisma.user.findUnique as any).mockResolvedValue(null);
    await expect(
      service.login({ email: 'x@y.com', password: 'wrong' })
    ).rejects.toThrow(UnauthorizedException);
  });
});
