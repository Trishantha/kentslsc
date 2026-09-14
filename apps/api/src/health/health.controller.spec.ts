import { jest, describe, it, expect, beforeEach } from '@jest/globals';
import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { TerminusModule } from '@nestjs/terminus';
import { HealthController } from './health.controller.js';
import { PrismaService } from '../core/prisma/prisma.service.js';
import { IS_PUBLIC_KEY } from '../common/decorators/public.decorator.js';
import { ROLES_KEY } from '../common/decorators/roles.decorator.js';
import { UserRole } from '@kentslsc/shared';

describe('HealthController', () => {
  let controller: HealthController;
  let prisma: jest.Mocked<PrismaService>;
  let config: jest.Mocked<ConfigService>;

  function createModule(env: Record<string, string | undefined>) {
    return Test.createTestingModule({
      imports: [TerminusModule],
      controllers: [HealthController],
      providers: [
        {
          provide: PrismaService,
          useValue: {
            $queryRaw: jest.fn()
          }
        },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string) => env[key])
          }
        }
      ]
    }).compile();
  }

  beforeEach(async () => {
    const module: TestingModule = await createModule({
      NODE_ENV: 'production',
      DATABASE_URL: 'postgresql://localhost/test',
      DEFAULT_PAYMENT_PROVIDER: 'stripe',
      STRIPE_SECRET_KEY: 'sk_test_xxx',
      STRIPE_WEBHOOK_SECRET: 'whsec_xxx',
      STRIPE_PUBLISHABLE_KEY: 'pk_test_xxx',
      EMAIL_HOST: 'smtp.example.com',
      EMAIL_USER: 'user',
      EMAIL_PASS: 'pass',
      EMAIL_FROM: 'noreply@example.com',
      SUPABASE_URL: 'https://example.supabase.co',
      SUPABASE_SERVICE_KEY: 'key'
    });

    controller = module.get<HealthController>(HealthController);
    prisma = module.get<PrismaService>(PrismaService) as jest.Mocked<PrismaService>;
    config = module.get<ConfigService>(ConfigService) as jest.Mocked<ConfigService>;
  });

  it('exposes operational endpoints without authentication', () => {
    expect(Reflect.getMetadata(IS_PUBLIC_KEY, HealthController.prototype.live)).toBe(true);
    expect(Reflect.getMetadata(IS_PUBLIC_KEY, HealthController.prototype.ready)).toBe(true);
  });

  it('restricts the metrics endpoint to admins', () => {
    expect(Reflect.getMetadata(IS_PUBLIC_KEY, HealthController.prototype.metrics)).not.toBe(true);
    expect(Reflect.getMetadata(ROLES_KEY, HealthController.prototype.metrics)).toEqual([
      UserRole.ADMIN
    ]);
  });

  it('live endpoint returns up', async () => {
    const result = await controller.live();
    expect(result.status).toBe('ok');
  });

  it('ready endpoint returns ok when all dependencies are healthy', async () => {
    prisma.$queryRaw.mockResolvedValue([{ 1: 1 }]);

    const result = await controller.ready();

    expect(result.status).toBe('ok');
    expect(result.info).toMatchObject({
      database: { status: 'up' },
      stripe: { status: 'up' },
      email: { status: 'up' },
      supabase: { status: 'up' }
    });
  });

  it('ready endpoint returns error when database is unreachable', async () => {
    prisma.$queryRaw.mockRejectedValue(new Error('Connection refused'));

    await expect(controller.ready()).rejects.toThrow();
  });

  it('ready endpoint returns error when Stripe config is missing in production', async () => {
    prisma.$queryRaw.mockResolvedValue([{ 1: 1 }]);
    jest.spyOn(config, 'get').mockImplementation((key: string) => {
      if (key === 'STRIPE_SECRET_KEY') return undefined;
      if (key === 'NODE_ENV') return 'production';
      if (key === 'DEFAULT_PAYMENT_PROVIDER') return 'stripe';
      return 'set';
    });

    await expect(controller.ready()).rejects.toThrow();
  });

  it('ready endpoint skips Stripe checks when PayPal is the provider', async () => {
    const module: TestingModule = await createModule({
      NODE_ENV: 'production',
      DATABASE_URL: 'postgresql://localhost/test',
      DEFAULT_PAYMENT_PROVIDER: 'paypal',
      PAYPAL_CLIENT_ID: 'id',
      PAYPAL_CLIENT_SECRET: 'secret',
      PAYPAL_WEBHOOK_ID: 'whid',
      EMAIL_HOST: 'smtp.example.com',
      EMAIL_USER: 'user',
      EMAIL_PASS: 'pass',
      EMAIL_FROM: 'noreply@example.com',
      SUPABASE_URL: 'https://example.supabase.co',
      SUPABASE_SERVICE_KEY: 'key'
    });
    controller = module.get<HealthController>(HealthController);
    prisma = module.get<PrismaService>(PrismaService) as jest.Mocked<PrismaService>;

    prisma.$queryRaw.mockResolvedValue([{ 1: 1 }]);

    const result = await controller.ready();
    expect(result.status).toBe('ok');
    expect(result.info).toMatchObject({
      paypal: { status: 'up' }
    });
  });
});
