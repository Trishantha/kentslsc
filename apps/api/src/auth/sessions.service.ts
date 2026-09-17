import { Injectable, Logger } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { AuthEventType, type Prisma } from '@kentslsc/database';
import { PrismaService } from '../core/prisma/prisma.service.js';
import { sha256 } from '../common/utils/crypto.js';

const REFRESH_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export function hashToken(token: string): string {
  return sha256(token);
}

/** Stored so sessions are attributable without retaining raw client IPs. */
export function hashIp(ip?: string | null): string | undefined {
  if (!ip) return undefined;
  return sha256(ip).slice(0, 32);
}

export interface RequestContext {
  ip?: string | null;
  userAgent?: string | null;
}

@Injectable()
export class SessionsService {
  private readonly logger = new Logger(SessionsService.name);

  constructor(
    private readonly prisma: PrismaService
  ) {}

  /** Allocate the session id up front so it can be embedded as the `sid` claim. */
  newSessionId(): string {
    return randomUUID();
  }

  async create(
    sessionId: string,
    userId: string,
    refreshToken: string,
    ctx: RequestContext
  ): Promise<void> {
    await this.prisma.session.create({
      data: {
        id: sessionId,
        userId,
        refreshTokenHash: hashToken(refreshToken),
        userAgent: ctx.userAgent?.slice(0, 500) ?? undefined,
        ipHash: hashIp(ctx.ip),
        expiresAt: new Date(Date.now() + REFRESH_TTL_MS)
      }
    });
  }

  /**
   * Rotate a refresh token.
   *
   * Returns the session when the presented token is the current one. If it
   * matches the *previous* hash the token has been replayed — either the user
   * kept a stale copy or an attacker stole one and the legitimate client has
   * since rotated past it. We cannot tell which, so the safe move is to kill the
   * session and make both parties re-authenticate.
   */
  async rotate(refreshToken: string): Promise<{ userId: string; sessionId: string } | null> {
    const presented = hashToken(refreshToken);

    const session = await this.prisma.session.findFirst({
      where: { OR: [{ refreshTokenHash: presented }, { prevRefreshTokenHash: presented }] }
    });

    if (!session) return null;

    if (session.revokedAt || session.expiresAt <= new Date()) {
      return null;
    }

    if (session.prevRefreshTokenHash === presented) {
      await this.revoke(session.id, 'refresh_token_reuse');
      await this.recordEvent({
        userId: session.userId,
        type: AuthEventType.REFRESH_REUSE_DETECTED,
        metadata: { sessionId: session.id }
      });
      this.logger.warn(`Refresh token reuse detected for session ${session.id}; session revoked`);
      return null;
    }

    return { userId: session.userId, sessionId: session.id };
  }

  /** Persist the newly issued refresh token, keeping the old hash for reuse detection. */
  async recordRotation(sessionId: string, newRefreshToken: string): Promise<void> {
    const current = await this.prisma.session.findUnique({
      where: { id: sessionId },
      select: { refreshTokenHash: true }
    });

    await this.prisma.session.update({
      where: { id: sessionId },
      data: {
        refreshTokenHash: hashToken(newRefreshToken),
        prevRefreshTokenHash: current?.refreshTokenHash ?? null,
        lastUsedAt: new Date()
      }
    });
  }

  async revoke(sessionId: string, reason: string): Promise<void> {
    await this.prisma.session.updateMany({
      where: { id: sessionId, revokedAt: null },
      data: { revokedAt: new Date(), revokedReason: reason }
    });
  }

  async revokeAllForUser(userId: string, reason: string, exceptSessionId?: string): Promise<number> {
    const sessions = await this.prisma.session.findMany({
      where: {
        userId,
        revokedAt: null,
        ...(exceptSessionId ? { id: { not: exceptSessionId } } : {})
      },
      select: { id: true }
    });

    if (sessions.length === 0) return 0;

    await this.prisma.session.updateMany({
      where: { id: { in: sessions.map((s) => s.id) } },
      data: { revokedAt: new Date(), revokedReason: reason }
    });

    return sessions.length;
  }

  async listForUser(userId: string, currentSessionId?: string) {
    const sessions = await this.prisma.session.findMany({
      where: { userId, revokedAt: null, expiresAt: { gt: new Date() } },
      orderBy: { lastUsedAt: 'desc' },
      select: {
        id: true,
        userAgent: true,
        createdAt: true,
        lastUsedAt: true,
        expiresAt: true
      }
    });

    return sessions.map((s) => ({ ...s, current: s.id === currentSessionId }));
  }

  async touch(sessionId: string): Promise<void> {
    await this.prisma.session
      .updateMany({ where: { id: sessionId }, data: { lastUsedAt: new Date() } })
      .catch(() => undefined);
  }

  async recordEvent(input: {
    userId?: string | null;
    email?: string | null;
    type: AuthEventType;
    ctx?: RequestContext;
    metadata?: Prisma.InputJsonValue;
  }): Promise<void> {
    try {
      await this.prisma.authEvent.create({
        data: {
          userId: input.userId ?? undefined,
          email: input.email ?? undefined,
          type: input.type,
          ipHash: hashIp(input.ctx?.ip),
          userAgent: input.ctx?.userAgent?.slice(0, 500) ?? undefined,
          metadata: input.metadata
        }
      });
    } catch (error) {
      // The audit trail must never break the request it is describing.
      this.logger.warn(`Failed to record auth event ${input.type}: ${(error as Error).message}`);
    }
  }
}
