import { BadRequestException, Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import { randomBytes } from 'crypto';
import { AuthEventType } from '@kentslsc/database';
import { PrismaService } from '../core/prisma/prisma.service.js';
import { EmailService } from '../email/email.service.js';
import { SessionsService, hashToken, hashIp, type RequestContext } from './sessions.service.js';
import { LoginLockoutService } from './login-lockout.service.js';

const VERIFICATION_TTL_HOURS = 24;
const RESET_TTL_MINUTES = 60;

/** 32 random bytes, url-safe. Only the sha256 is persisted. */
function generateToken(): string {
  return randomBytes(32).toString('base64url');
}

@Injectable()
export class CredentialsService {
  private readonly logger = new Logger(CredentialsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly email: EmailService,
    private readonly sessions: SessionsService,
    private readonly lockout: LoginLockoutService
  ) {}

  private get frontendUrl(): string {
    return this.config.get<string>('FRONTEND_URL') ?? 'http://localhost:3000';
  }

  /** Only ever exposed outside production, and only behind an explicit flag. */
  private get devExposeTokens(): boolean {
    return (
      process.env.NODE_ENV !== 'production' &&
      this.config.get<string>('AUTH_DEV_RETURN_VERIFICATION_TOKEN') === 'true'
    );
  }

  // ---------------------------------------------------------------------------
  // Email verification
  // ---------------------------------------------------------------------------

  async sendVerificationEmail(
    userId: string,
    ctx: RequestContext = {}
  ): Promise<{ verificationUrl?: string }> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true, name: true, firstName: true, emailVerifiedAt: true }
    });
    if (!user) throw new BadRequestException('Unknown account');
    if (user.emailVerifiedAt) return {};

    const token = generateToken();

    // Invalidate any outstanding links so only the newest one works.
    await this.prisma.emailVerificationToken.updateMany({
      where: { userId, consumedAt: null },
      data: { consumedAt: new Date() }
    });

    await this.prisma.emailVerificationToken.create({
      data: {
        userId,
        tokenHash: hashToken(token),
        email: user.email,
        expiresAt: new Date(Date.now() + VERIFICATION_TTL_HOURS * 60 * 60 * 1000)
      }
    });

    const verificationUrl = `${this.frontendUrl}/en/auth/verify-email?token=${encodeURIComponent(token)}`;

    await this.email
      .sendEmailVerification(
        user.email,
        user.firstName ?? user.name,
        verificationUrl,
        VERIFICATION_TTL_HOURS
      )
      .catch((error) => this.logger.warn(`Verification email failed: ${(error as Error).message}`));

    await this.sessions.recordEvent({
      userId,
      email: user.email,
      type: AuthEventType.EMAIL_VERIFICATION_SENT,
      ctx
    });

    return this.devExposeTokens ? { verificationUrl } : {};
  }

  async verifyEmail(token: string, ctx: RequestContext = {}): Promise<{ alreadyVerified: boolean }> {
    const record = await this.prisma.emailVerificationToken.findUnique({
      where: { tokenHash: hashToken(token) },
      include: { user: { select: { id: true, email: true, emailVerifiedAt: true } } }
    });

    if (!record || record.consumedAt || record.expiresAt <= new Date()) {
      throw new BadRequestException({
        code: 'INVALID_VERIFICATION_TOKEN',
        message: 'This verification link is invalid or has expired. Request a new one.'
      });
    }

    if (record.user.emailVerifiedAt) {
      await this.prisma.emailVerificationToken.update({
        where: { id: record.id },
        data: { consumedAt: new Date() }
      });
      return { alreadyVerified: true };
    }

    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: record.userId },
        data: { emailVerifiedAt: new Date() }
      }),
      this.prisma.emailVerificationToken.update({
        where: { id: record.id },
        data: { consumedAt: new Date() }
      })
    ]);

    await this.sessions.recordEvent({
      userId: record.userId,
      email: record.user.email,
      type: AuthEventType.EMAIL_VERIFIED,
      ctx
    });

    return { alreadyVerified: false };
  }

  // ---------------------------------------------------------------------------
  // Password reset
  // ---------------------------------------------------------------------------

  /**
   * Always succeeds from the caller's point of view. The controller returns an
   * identical 202 whether or not the address exists, so this endpoint cannot be
   * used to enumerate accounts.
   */
  async requestPasswordReset(rawEmail: string, ctx: RequestContext = {}): Promise<void> {
    const email = rawEmail.toLowerCase().trim();
    const user = await this.prisma.user.findUnique({
      where: { email },
      select: { id: true, email: true, name: true, firstName: true, deletedAt: true }
    });

    if (!user || user.deletedAt) return;

    const token = generateToken();
    await this.prisma.passwordResetToken.create({
      data: {
        userId: user.id,
        tokenHash: hashToken(token),
        ipHash: hashIp(ctx.ip),
        expiresAt: new Date(Date.now() + RESET_TTL_MINUTES * 60 * 1000)
      }
    });

    const resetUrl = `${this.frontendUrl}/en/auth/reset-password?token=${encodeURIComponent(token)}`;
    await this.email
      .sendPasswordReset(user.email, user.firstName ?? user.name, resetUrl, RESET_TTL_MINUTES)
      .catch((error) => this.logger.warn(`Reset email failed: ${(error as Error).message}`));

    await this.sessions.recordEvent({
      userId: user.id,
      email: user.email,
      type: AuthEventType.PASSWORD_RESET_REQUESTED,
      ctx
    });
  }

  async resetPassword(token: string, newPassword: string, ctx: RequestContext = {}): Promise<void> {
    const record = await this.prisma.passwordResetToken.findUnique({
      where: { tokenHash: hashToken(token) },
      include: { user: { select: { id: true, email: true, name: true, firstName: true, deletedAt: true } } }
    });

    if (!record || record.consumedAt || record.expiresAt <= new Date() || record.user.deletedAt) {
      throw new BadRequestException({
        code: 'INVALID_RESET_TOKEN',
        message: 'This reset link is invalid or has expired. Request a new one.'
      });
    }

    const passwordHash = await bcrypt.hash(newPassword, 12);

    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: record.userId },
        data: { passwordHash, passwordChangedAt: new Date() }
      }),
      this.prisma.passwordResetToken.update({
        where: { id: record.id },
        data: { consumedAt: new Date() }
      }),
      // Burn any other outstanding links for this account.
      this.prisma.passwordResetToken.updateMany({
        where: { userId: record.userId, consumedAt: null },
        data: { consumedAt: new Date() }
      })
    ]);

    // Whoever reset the password now owns the account; every existing session
    // (including an attacker's) must go.
    await this.sessions.revokeAllForUser(record.userId, 'password_reset');
    await this.lockout.clear(record.user.email);

    await this.sessions.recordEvent({
      userId: record.userId,
      email: record.user.email,
      type: AuthEventType.PASSWORD_CHANGED,
      ctx,
      metadata: { via: 'reset' }
    });

    await this.email
      .sendPasswordChanged(record.user.email, record.user.firstName ?? record.user.name)
      .catch(() => undefined);
  }

  /**
   * Change password for a signed-in user. Keeps the current session alive and
   * kills every other one, so a user changing their password because they think
   * they've been compromised boots the attacker without logging themselves out.
   */
  async changePassword(
    userId: string,
    currentSessionId: string | undefined,
    currentPassword: string,
    newPassword: string,
    ctx: RequestContext = {}
  ): Promise<void> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user || user.deletedAt) throw new UnauthorizedException('Invalid credentials');

    const valid = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!valid) throw new UnauthorizedException('Current password is incorrect');

    const passwordHash = await bcrypt.hash(newPassword, 12);
    await this.prisma.user.update({
      where: { id: userId },
      data: { passwordHash, passwordChangedAt: new Date() }
    });

    await this.sessions.revokeAllForUser(userId, 'password_changed', currentSessionId);

    await this.sessions.recordEvent({
      userId,
      email: user.email,
      type: AuthEventType.PASSWORD_CHANGED,
      ctx,
      metadata: { via: 'change' }
    });

    await this.email
      .sendPasswordChanged(user.email, user.firstName ?? user.name)
      .catch(() => undefined);
  }

  /** Used by the admin invite flow: a reset token doubles as a set-password link. */
  async createSetPasswordLink(userId: string, ttlDays = 7): Promise<string> {
    const token = generateToken();
    await this.prisma.passwordResetToken.create({
      data: {
        userId,
        tokenHash: hashToken(token),
        expiresAt: new Date(Date.now() + ttlDays * 24 * 60 * 60 * 1000)
      }
    });
    return `${this.frontendUrl}/en/auth/reset-password?token=${encodeURIComponent(token)}`;
  }
}
