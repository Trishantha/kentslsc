import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash } from 'crypto';
import { AuthEventType } from '@kentslsc/database';
import { PrismaService } from '../core/prisma/prisma.service.js';

/**
 * Per-account login lockout.
 *
 * Keyed on the account, not the IP. The web app proxies /api through Next,
 * which does not forward x-forwarded-for, so in the deployed configuration
 * every request reaches the API with the same source address — IP-based
 * counting would either do nothing or lock out everyone at once.
 *
 * State lives in Postgres so it is part of the Supabase-backed system of
 * record. The counters are derived from auth_events, which keeps the design
 * auditable without introducing a separate cache layer.
 */
@Injectable()
export class LoginLockoutService {
  private readonly logger = new Logger(LoginLockoutService.name);

  /** Failures within this window count toward the threshold. */
  private readonly windowSeconds = 15 * 60;
  /** Escalating lock durations for repeat offenders, in seconds. */
  private readonly ladder = [15 * 60, 30 * 60, 60 * 60];

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService
  ) {}

  private get maxFailures(): number {
    return Number(this.config.get('LOGIN_MAX_FAILURES') ?? 8);
  }

  private async latestEvent(
    email: string,
    types: AuthEventType[]
  ): Promise<{ createdAt: Date; metadata: unknown } | null> {
    return this.prisma.authEvent.findFirst({
      where: { email: email.toLowerCase().trim(), type: { in: types } },
      orderBy: { createdAt: 'desc' },
      select: { createdAt: true, metadata: true }
    });
  }

  private async recentCutoff(email: string): Promise<Date> {
    const [lastClear, lastLockout] = await Promise.all([
      this.latestEvent(email, [AuthEventType.LOCKOUT_CLEARED]),
      this.latestEvent(email, [AuthEventType.LOCKOUT])
    ]);

    const candidates = [lastClear?.createdAt, lastLockout?.createdAt].filter(
      (value): value is Date => value instanceof Date
    );
    return candidates.length > 0 ? new Date(Math.max(...candidates.map((value) => value.getTime()))) : new Date(0);
  }

  private lockDurationFromMetadata(metadata: unknown): number | null {
    if (!metadata || typeof metadata !== 'object') return null;
    const value = (metadata as { lockedForSeconds?: unknown }).lockedForSeconds;
    return typeof value === 'number' && Number.isFinite(value) ? value : null;
  }

  /** Seconds remaining on the lock, or 0 when not locked. */
  async lockedFor(email: string): Promise<number> {
    try {
      const lockout = await this.latestEvent(email, [AuthEventType.LOCKOUT]);
      if (!lockout) return 0;

      const cleared = await this.latestEvent(email, [AuthEventType.LOCKOUT_CLEARED]);
      if (cleared && cleared.createdAt > lockout.createdAt) return 0;

      const duration = this.lockDurationFromMetadata(lockout.metadata);
      if (!duration) return 0;

      const expiresAt = lockout.createdAt.getTime() + duration * 1000;
      const remaining = Math.ceil((expiresAt - Date.now()) / 1000);
      return remaining > 0 ? remaining : 0;
    } catch (error) {
      // Never let a lockout lookup block legitimate logins outright.
      this.logger.error(`Lockout check failed: ${(error as Error).message}`);
      return 0;
    }
  }

  /**
   * Record a failed attempt. Returns the lock duration in seconds if this
   * attempt tripped the lock, otherwise null.
   */
  async recordFailure(email: string): Promise<number | null> {
    try {
      const cutoff = await this.recentCutoff(email);
      const failures = await this.prisma.authEvent.count({
        where: {
          email: email.toLowerCase().trim(),
          type: AuthEventType.LOGIN_FAILURE,
          createdAt: {
            gt: cutoff,
            gte: new Date(Date.now() - this.windowSeconds * 1000)
          }
        }
      });
      const nextCount = failures + 1;
      if (nextCount < this.maxFailures) return null;

      const offences = await this.prisma.authEvent.count({
        where: {
          email: email.toLowerCase().trim(),
          type: AuthEventType.LOCKOUT,
          createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) }
        }
      });
      const index = Math.min(Math.max(offences - 1, 0), this.ladder.length - 1);
      const duration = this.ladder[index] ?? this.ladder[this.ladder.length - 1]!;

      await this.prisma.authEvent.create({
        data: {
          email: email.toLowerCase().trim(),
          type: AuthEventType.LOCKOUT,
          metadata: { lockedForSeconds: duration, failures: nextCount, windowSeconds: this.windowSeconds }
        }
      });

      return duration;
    } catch (error) {
      this.logger.error(`Failed to record login failure: ${(error as Error).message}`);
      return null;
    }
  }

  async clear(email: string): Promise<void> {
    try {
      await this.prisma.authEvent.create({
        data: {
          email: email.toLowerCase().trim(),
          type: AuthEventType.LOCKOUT_CLEARED
        }
      });
    } catch (error) {
      this.logger.warn(`Failed to clear lockout state: ${(error as Error).message}`);
    }
  }
}
