import { Injectable, UnauthorizedException, ConflictException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import { randomUUID } from 'crypto';
import { PrismaService } from '../core/prisma/prisma.service.js';
import { AuthEventType, Prisma } from '@kentslsc/database';
import { MembershipsService } from '../memberships/memberships.service.js';
import { MembershipFeaturesService } from '../memberships/membership-features.service.js';
import { LoginInput, UserRole, TokenPayload, MembershipFeature } from '@kentslsc/shared';
import { RegisterDto } from './dto/register.dto.js';
import { SessionsService, type RequestContext } from './sessions.service.js';
import { LoginLockoutService } from './login-lockout.service.js';
import { EmailService } from '../email/email.service.js';

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

/**
 * A real bcrypt hash of a value nobody will guess, compared against when the
 * account doesn't exist so that "unknown email" and "wrong password" take the
 * same time. A module-load bcrypt.hashSync would add ~250ms to boot.
 */
const DUMMY_PASSWORD_HASH = '$2b$12$e5SpRw7fTzbxf9KJkS5.ju44zuWahHvbQDDVpMlMQ.1mFuDaaGxXW';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly sessions: SessionsService,
    private readonly lockout: LoginLockoutService,
    private readonly emailService: EmailService,
    private readonly membershipsService: MembershipsService,
    private readonly featuresService: MembershipFeaturesService
  ) {}

  async register(data: RegisterDto, ctx: RequestContext = {}) {
    const email = data.email.toLowerCase().trim();
    const existing = await this.prisma.user.findUnique({ where: { email } });
    if (existing) {
      throw new ConflictException('Email already registered');
    }

    const passwordHash = await bcrypt.hash(data.password, 12);
    const fullName = `${data.firstName} ${data.lastName}`.trim();
    const user = await this.prisma.user.create({
      data: {
        name: fullName,
        firstName: data.firstName,
        lastName: data.lastName,
        email,
        phone: data.phone,
        address: data.address ? (data.address as unknown as Prisma.InputJsonValue) : undefined,
        passwordHash,
        role: UserRole.GUEST
      }
    });

    let applicationResult:
      | { paid: true; sessionId: string; url: string }
      | { paid: false; membership: unknown }
      | null = null;

    if (data.application) {
      const app = data.application;
      applicationResult = (await this.membershipsService.processApplication(user.id, user.email, {
        membershipTypeId: app.membershipTypeId,
        fullName: app.fullName,
        address: app.address,
        phone: app.phone,
        dependants: app.dependants ?? []
      })) as
        | { paid: true; sessionId: string; url: string }
        | { paid: false; membership: unknown };
    }

    await this.sessions.recordEvent({
      userId: user.id,
      email: user.email,
      type: AuthEventType.EMAIL_VERIFICATION_SENT,
      ctx
    });

    // NOTE: no tokens are minted here. Registration must never establish or
    // replace a session — that is what allowed an admin filling in the signup
    // form to be silently swapped into a brand new GUEST account.
    return {
      user: {
        id: user.id,
        name: user.name,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        role: user.role
      },
      application: applicationResult
    };
  }

  async login(data: LoginInput, ctx: RequestContext = {}): Promise<AuthTokens> {
    const email = data.email.toLowerCase().trim();
    const lockedFor = await this.lockout.lockedFor(email);
    const user = await this.prisma.user.findUnique({ where: { email } });

    // Always run exactly one bcrypt compare — even when the account is missing
    // or already locked — so response time never reveals whether the email is
    // registered or whether the account is currently locked out.
    const valid = await bcrypt.compare(data.password, user?.passwordHash ?? DUMMY_PASSWORD_HASH);

    if (lockedFor > 0) {
      // Identical error to a bad password: saying "account locked" would confirm
      // the address exists and tell an attacker their spray is working.
      throw new UnauthorizedException('Invalid credentials');
    }

    if (!user || user.deletedAt || !valid) {
      const lockedNow = await this.lockout.recordFailure(email);
      await this.sessions.recordEvent({
        email,
        userId: user?.id,
        type: AuthEventType.LOGIN_FAILURE,
        ctx
      });

      if (lockedNow && user) {
        await this.sessions.recordEvent({
          email,
          userId: user.id,
          type: AuthEventType.LOCKOUT,
          ctx,
          metadata: { lockedForSeconds: lockedNow }
        });
        // Tell the real owner, since a lockout may be someone attacking them.
        await this.emailService
          .sendAccountLocked(user.email, user.firstName ?? user.name, lockedNow)
          .catch(() => undefined);
      }

      throw new UnauthorizedException('Invalid credentials');
    }

    await this.lockout.clear(email);

    const tokens = await this.issueSession(user.id, user.email, user.role as UserRole, ctx);

    await this.sessions.recordEvent({
      userId: user.id,
      email: user.email,
      type: AuthEventType.LOGIN_SUCCESS,
      ctx
    });

    return tokens;
  }

  /** Start a brand-new device session. */
  async issueSession(
    userId: string,
    email: string,
    role: UserRole,
    ctx: RequestContext = {}
  ): Promise<AuthTokens> {
    const sessionId = this.sessions.newSessionId();
    const tokens = await this.signTokens(userId, email, role, sessionId);
    await this.sessions.create(sessionId, userId, tokens.refreshToken, ctx);
    return tokens;
  }

  async refresh(refreshToken: string): Promise<AuthTokens> {
    let payload: TokenPayload;
    try {
      payload = await this.jwtService.verifyAsync<TokenPayload>(refreshToken, {
        secret: this.configService.getOrThrow<string>('JWT_REFRESH_SECRET')
      });
    } catch {
      throw new UnauthorizedException('Invalid refresh token');
    }

    if ((payload.typ ?? 'refresh') !== 'refresh') {
      throw new UnauthorizedException('Invalid refresh token');
    }

    // Also detects replay of an already-rotated token, which revokes the session.
    const rotated = await this.sessions.rotate(refreshToken);
    if (!rotated) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    const user = await this.prisma.user.findUnique({ where: { id: rotated.userId } });
    if (!user || user.deletedAt) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    const tokens = await this.signTokens(
      user.id,
      user.email,
      user.role as UserRole,
      rotated.sessionId
    );
    await this.sessions.recordRotation(rotated.sessionId, tokens.refreshToken);

    return tokens;
  }

  async logout(userId: string, sessionId?: string, ctx: RequestContext = {}) {
    if (sessionId) {
      await this.sessions.revoke(sessionId, 'logout');
    } else {
      // No sid (a token predating this change): revoke everything for the user
      // rather than leave a session we can't identify still alive.
      await this.sessions.revokeAllForUser(userId, 'logout');
    }
    await this.sessions.recordEvent({ userId, type: AuthEventType.LOGOUT, ctx });
  }

  async logoutAll(userId: string, ctx: RequestContext = {}) {
    const count = await this.sessions.revokeAllForUser(userId, 'logout_all');
    await this.sessions.recordEvent({
      userId,
      type: AuthEventType.LOGOUT,
      ctx,
      metadata: { scope: 'all', revoked: count }
    });
    return count;
  }

  async getUserFeatures(userId: string): Promise<MembershipFeature[]> {
    return this.featuresService.userActiveFeatures(userId);
  }

  /**
   * Short-lived token for the websocket handshake. Marked `typ: 'ws'` so it
   * cannot be replayed as a bearer access token — it is handed to browser JS and
   * is therefore reachable by XSS, unlike the httpOnly cookies.
   */
  async createSocketToken(
    userId: string,
    email: string,
    role: UserRole,
    sessionId: string
  ): Promise<string> {
    return this.jwtService.signAsync(
      { sub: userId, email, role, sid: sessionId, jti: randomUUID(), typ: 'ws' },
      {
        secret: this.configService.getOrThrow<string>('JWT_SECRET'),
        expiresIn: '5m' as never
      }
    );
  }

  private async signTokens(
    userId: string,
    email: string,
    role: UserRole,
    sessionId: string
  ): Promise<AuthTokens> {
    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync(
        { sub: userId, email, role, sid: sessionId, jti: randomUUID(), typ: 'access' },
        {
          secret: this.configService.getOrThrow<string>('JWT_SECRET'),
          expiresIn: (this.configService.get<string>('JWT_ACCESS_EXPIRY') ?? '15m') as never
        }
      ),
      this.jwtService.signAsync(
        { sub: userId, email, role, sid: sessionId, jti: randomUUID(), typ: 'refresh' },
        {
          secret: this.configService.getOrThrow<string>('JWT_REFRESH_SECRET'),
          expiresIn: (this.configService.get<string>('JWT_REFRESH_EXPIRY') ?? '7d') as never
        }
      )
    ]);

    return { accessToken, refreshToken };
  }
}
