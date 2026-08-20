import { Controller, Get } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  HealthCheck,
  HealthCheckService,
  HealthIndicatorResult,
  MemoryHealthIndicator
} from '@nestjs/terminus';
import { PrismaService } from '../core/prisma/prisma.service.js';
import { AuthEventType } from '@kentslsc/database';

/**
 * Health and readiness endpoints for load balancers and monitoring.
 *
 * `/health/live` always returns 200 if the process is up.
 * `/health/ready` returns 200 only when critical dependencies are reachable.
 */
@Controller('health')
export class HealthController {
  constructor(
    private readonly health: HealthCheckService,
    private readonly memory: MemoryHealthIndicator,
    private readonly prisma: PrismaService,
    private readonly config: ConfigService
  ) {}

  @Get('live')
  @HealthCheck()
  live() {
    return this.health.check([
      () => this.memory.checkHeap('memory_heap', 512 * 1024 * 1024)
    ]);
  }

  @Get('ready')
  @HealthCheck()
  async ready() {
    const checks: (() => Promise<HealthIndicatorResult>)[] = [
      () => this.memory.checkHeap('memory_heap', 512 * 1024 * 1024),
      () => this.checkDatabase()
    ];

    if (this.isProviderEnabled('stripe')) {
      checks.push(() => this.checkStripeConfig());
    }
    if (this.isProviderEnabled('paypal')) {
      checks.push(() => this.checkPayPalConfig());
    }
    if (this.isEmailRequired()) {
      checks.push(() => this.checkEmailConfig());
    }
    if (this.isSupabaseConfigured()) {
      checks.push(() => this.checkSupabaseConfig());
    }

    return this.health.check(checks);
  }

  private async checkDatabase(): Promise<HealthIndicatorResult> {
    const databaseUrl = this.config.get<string>('DATABASE_URL');
    if (!databaseUrl) {
      return { database: { status: 'down' } };
    }

    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return { database: { status: 'up' } };
    } catch (err) {
      return { database: { status: 'down', message: (err as Error).message } };
    }
  }

  private async checkStripeConfig(): Promise<HealthIndicatorResult> {
    const secretKey = this.config.get<string>('STRIPE_SECRET_KEY');
    const webhookSecret = this.config.get<string>('STRIPE_WEBHOOK_SECRET');
    const publishableKey = this.config.get<string>('STRIPE_PUBLISHABLE_KEY');

    if (!secretKey || !webhookSecret || !publishableKey) {
      return {
        stripe: {
          status: 'down',
          message: 'Missing STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET, or STRIPE_PUBLISHABLE_KEY'
        }
      };
    }

    return { stripe: { status: 'up' } };
  }

  private async checkPayPalConfig(): Promise<HealthIndicatorResult> {
    const clientId = this.config.get<string>('PAYPAL_CLIENT_ID');
    const clientSecret = this.config.get<string>('PAYPAL_CLIENT_SECRET');
    const webhookId = this.config.get<string>('PAYPAL_WEBHOOK_ID');

    if (!clientId || !clientSecret || !webhookId) {
      return {
        paypal: {
          status: 'down',
          message: 'Missing PAYPAL_CLIENT_ID, PAYPAL_CLIENT_SECRET, or PAYPAL_WEBHOOK_ID'
        }
      };
    }

    return { paypal: { status: 'up' } };
  }

  private async checkEmailConfig(): Promise<HealthIndicatorResult> {
    const host = this.config.get<string>('EMAIL_HOST');
    const user = this.config.get<string>('EMAIL_USER');
    const pass = this.config.get<string>('EMAIL_PASS');
    const from = this.config.get<string>('EMAIL_FROM');

    if (!host || !user || !pass || !from) {
      return {
        email: {
          status: 'down',
          message: 'Missing EMAIL_HOST, EMAIL_USER, EMAIL_PASS, or EMAIL_FROM'
        }
      };
    }

    return { email: { status: 'up' } };
  }

  private async checkSupabaseConfig(): Promise<HealthIndicatorResult> {
    const url = this.config.get<string>('SUPABASE_URL');
    const serviceKey = this.config.get<string>('SUPABASE_SERVICE_KEY');

    if (!url || !serviceKey) {
      return {
        supabase: {
          status: 'down',
          message: 'Missing SUPABASE_URL or SUPABASE_SERVICE_KEY'
        }
      };
    }

    return { supabase: { status: 'up' } };
  }

  private isProviderEnabled(provider: 'stripe' | 'paypal'): boolean {
    const configuredProvider = this.config.get<string>('DEFAULT_PAYMENT_PROVIDER');
    return configuredProvider === provider;
  }

  private isEmailRequired(): boolean {
    return this.config.get<string>('NODE_ENV') === 'production';
  }

  private isSupabaseConfigured(): boolean {
    return !!this.config.get<string>('SUPABASE_URL') || this.config.get<string>('NODE_ENV') === 'production';
  }

  /**
   * Operational metrics for launch observability. Counts recent auth failures,
   * webhook failures, and database errors so operators can spot problems without
   * scraping logs.
   */
  @Get('metrics')
  async metrics() {
    const since = new Date(Date.now() - 60 * 60 * 1000);

    const [
      authFailures,
      webhookFailures,
      failedWebhooksByProvider
    ] = await Promise.all([
      this.prisma.authEvent.count({
        where: {
          type: { in: [AuthEventType.LOGIN_FAILURE, AuthEventType.LOCKOUT] },
          createdAt: { gte: since }
        }
      }),
      this.prisma.webhookEvent.count({
        where: {
          status: 'failed',
          createdAt: { gte: since }
        }
      }),
      this.prisma.webhookEvent.groupBy({
        by: ['provider'],
        where: {
          status: 'failed',
          createdAt: { gte: since }
        },
        _count: { provider: true }
      })
    ]);

    return {
      windowSeconds: 3600,
      authFailures,
      webhookFailures,
      failedWebhooksByProvider: failedWebhooksByProvider.map((row) => ({
        provider: row.provider,
        count: row._count.provider
      }))
    };
  }
}
