import {
  Body,
  ConflictException,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Req,
  Res,
  UnauthorizedException
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { AuthService } from './auth.service.js';
import { SessionsService, type RequestContext } from './sessions.service.js';
import { RegisterDto } from './dto/register.dto.js';
import { LoginDto } from './dto/login.dto.js';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import { Public } from '../common/decorators/public.decorator.js';
import { AllowUnverified } from '../common/decorators/allow-unverified.decorator.js';
import { OptionalAuth } from '../common/decorators/optional-auth.decorator.js';
import { CredentialsService } from './credentials.service.js';
import {
  ForgotPasswordDto,
  ResetPasswordDto,
  ChangePasswordDto,
  VerifyEmailDto
} from './dto/password.dto.js';
import { UserRole, type TokenPayload } from '@kentslsc/shared';
import type { AuthenticatedUser } from '../common/types/authenticated-user.js';
import { PrismaService } from '../core/prisma/prisma.service.js';
import { authCookieOptions } from './auth-cookies.js';

@ApiTags('Auth')
@Controller('auth')
// NOTE: deliberately no class-level @Throttle. It previously applied
// { limit: 5, ttl: 15 } to every handler including GET /auth/me, which the web
// client polls. With the ttl unit corrected to milliseconds that would become
// 5 requests per 15 minutes, shared across everyone behind the same IP.
// Throttles are applied per route below, on the endpoints that need them.
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly sessions: SessionsService,
    private readonly credentials: CredentialsService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService
  ) {}

  @Post('register')
  @Public()
  @Throttle({ default: { limit: 5, ttl: 3_600_000, blockDuration: 3_600_000 } })
  async register(
    @Body() dto: RegisterDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response
  ) {
    // Registration must never touch an existing session. Previously this handler
    // set cookies unconditionally, so an admin who submitted the signup form was
    // silently swapped into the new GUEST account they had just created.
    const existing = req.cookies?.accessToken as string | undefined;
    if (existing) {
      if (await this.hasValidAccessToken(existing)) {
        throw new ConflictException({
          code: 'ALREADY_AUTHENTICATED',
          message: 'You are already signed in. Sign out before creating a new account.'
        });
      }
      // Stale or forged cookie: clear it rather than permanently blocking
      // registration on a shared machine.
      this.clearAuthCookies(res);
    }

    const result = await this.authService.register(dto, this.context(req));
    const verification = await this.credentials.sendVerificationEmail(
      result.user.id,
      this.context(req)
    );

    return {
      success: true,
      requiresVerification: true,
      user: result.user,
      application: result.application,
      ...verification
    };
  }

  @Post('login')
  @Public()
  @Throttle({ default: { limit: 10, ttl: 300_000, blockDuration: 900_000 } })
  @HttpCode(HttpStatus.OK)
  async login(
    @Body() dto: LoginDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response
  ) {
    const tokens = await this.authService.login(dto, this.context(req));
    this.setAuthCookies(res, tokens);

    // Returned so the client can route without a second round trip.
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email.toLowerCase().trim() },
      select: { role: true, emailVerifiedAt: true }
    });

    return {
      success: true,
      role: user?.role,
      emailVerified: user?.emailVerifiedAt !== null && user?.emailVerifiedAt !== undefined
    };
  }

  @Post('refresh')
  @Public()
  @Throttle({ default: { limit: 60, ttl: 300_000 } })
  @HttpCode(HttpStatus.OK)
  async refresh(
    @Body('refreshToken') bodyRefreshToken: string,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response
  ) {
    const refreshToken = bodyRefreshToken || req.cookies?.refreshToken;
    if (!refreshToken) {
      throw new UnauthorizedException('Invalid refresh token');
    }
    try {
      const tokens = await this.authService.refresh(refreshToken);
      this.setAuthCookies(res, tokens);
      return { success: true };
    } catch (error) {
      // A dead refresh token should leave the browser clean, otherwise the
      // client keeps retrying with a cookie that can never work again.
      this.clearAuthCookies(res);
      throw error;
    }
  }

  @Post('logout')
  @AllowUnverified()
  @HttpCode(HttpStatus.OK)
  async logout(
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response
  ) {
    await this.authService.logout(user.sub, user.sid, this.context(req));
    this.clearAuthCookies(res);
    return { success: true };
  }

  @Post('logout-all')
  @AllowUnverified()
  @HttpCode(HttpStatus.OK)
  async logoutAll(
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response
  ) {
    const revoked = await this.authService.logoutAll(user.sub, this.context(req));
    this.clearAuthCookies(res);
    return { success: true, revoked };
  }

  @Get('sessions')
  @AllowUnverified()
  @ApiBearerAuth()
  async listSessions(@CurrentUser() user: AuthenticatedUser) {
    return this.sessions.listForUser(user.sub, user.sid);
  }

  @Delete('sessions/:id')
  @AllowUnverified()
  @HttpCode(HttpStatus.OK)
  async revokeSession(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    const session = await this.prisma.session.findUnique({
      where: { id },
      select: { userId: true }
    });
    if (!session || session.userId !== user.sub) {
      throw new ForbiddenException('Session not found');
    }
    await this.sessions.revoke(id, 'revoked_by_user');
    return { success: true };
  }

  /**
   * Read-only session probe for Next server components.
   *
   * Accepts the refresh token as well as the access token: a Next server layout
   * cannot call cookies().set(), so it cannot refresh. If this only honoured the
   * 15-minute access token, every user would be bounced to login a quarter of an
   * hour into a 7-day session. Rotates nothing and sets nothing.
   */
  @Get('session')
  @Public()
  async session(@Req() req: Request) {
    const anonymous = { authenticated: false } as const;

    const accessToken = req.cookies?.accessToken as string | undefined;
    if (accessToken) {
      const payload = await this.verifyToken(accessToken, 'JWT_SECRET');
      if (payload && (payload.typ ?? 'access') === 'access') {
        return this.describeSession(payload);
      }
    }

    const refreshToken = req.cookies?.refreshToken as string | undefined;
    if (refreshToken) {
      const payload = await this.verifyToken(refreshToken, 'JWT_REFRESH_SECRET');
      if (payload && (payload.typ ?? 'refresh') === 'refresh') {
        // The session row is the authority on whether this is still live.
        const session = payload.sid
          ? await this.prisma.session.findUnique({
              where: { id: payload.sid },
              select: { revokedAt: true, expiresAt: true }
            })
          : null;
        if (session && !session.revokedAt && session.expiresAt > new Date()) {
          return this.describeSession(payload);
        }
      }
    }

    return anonymous;
  }

  // ---------------------------------------------------------------------------
  // Email verification
  // ---------------------------------------------------------------------------

  @Post('verify-email')
  @Public()
  @Throttle({ default: { limit: 20, ttl: 600_000 } })
  @HttpCode(HttpStatus.OK)
  async verifyEmail(@Body() dto: VerifyEmailDto, @Req() req: Request) {
    const result = await this.credentials.verifyEmail(dto.token, this.context(req));
    return { success: true, ...result };
  }

  /**
   * Authenticated on purpose. The user is already sitting on the "verify your
   * email" screen, so there is no email parameter to submit — which means this
   * endpoint cannot be used to probe whether an address is registered.
   */
  @Post('resend-verification')
  @AllowUnverified()
  @Throttle({ default: { limit: 5, ttl: 3_600_000 } })
  @HttpCode(HttpStatus.OK)
  async resendVerification(@CurrentUser() user: AuthenticatedUser, @Req() req: Request) {
    const result = await this.credentials.sendVerificationEmail(user.sub, this.context(req));
    return { success: true, ...result };
  }

  // ---------------------------------------------------------------------------
  // Password management
  // ---------------------------------------------------------------------------

  @Post('forgot-password')
  @Public()
  @Throttle({ default: { limit: 5, ttl: 3_600_000, blockDuration: 3_600_000 } })
  @HttpCode(HttpStatus.ACCEPTED)
  async forgotPassword(@Body() dto: ForgotPasswordDto, @Req() req: Request) {
    await this.credentials.requestPasswordReset(dto.email, this.context(req));
    // Deliberately identical whether or not the account exists.
    return {
      success: true,
      message: 'If that email address has an account, a reset link is on its way.'
    };
  }

  @Post('reset-password')
  @Public()
  @Throttle({ default: { limit: 20, ttl: 600_000 } })
  @HttpCode(HttpStatus.OK)
  async resetPassword(
    @Body() dto: ResetPasswordDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response
  ) {
    await this.credentials.resetPassword(dto.token, dto.password, this.context(req));
    // No cookies issued: the user signs in fresh with the new password.
    this.clearAuthCookies(res);
    return { success: true };
  }

  @Post('change-password')
  @AllowUnverified()
  @Throttle({ default: { limit: 10, ttl: 600_000 } })
  @HttpCode(HttpStatus.OK)
  async changePassword(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: ChangePasswordDto,
    @Req() req: Request
  ) {
    await this.credentials.changePassword(
      user.sub,
      user.sid,
      dto.currentPassword,
      dto.newPassword,
      this.context(req)
    );
    return { success: true };
  }

  @Get('me')
  @Public()
  @ApiBearerAuth()
  async me(@OptionalAuth() user: AuthenticatedUser | null) {
    if (!user) return null;

    const profile = await this.prisma.user.findUnique({
      where: { id: user.sub },
      select: {
        id: true,
        name: true,
        firstName: true,
        lastName: true,
        email: true,
        phone: true,
        address: true,
        role: true,
        emailVerifiedAt: true,
        createdAt: true
      }
    });
    if (!profile) return null;

    const { emailVerifiedAt, ...rest } = profile;
    return { ...rest, emailVerified: emailVerifiedAt !== null };
  }

  @Get('features')
  @Public()
  @ApiBearerAuth()
  async features(@OptionalAuth() user: AuthenticatedUser | null) {
    if (!user) return [];
    return this.authService.getUserFeatures(user.sub);
  }

  @Get('socket-token')
  @ApiBearerAuth()
  async socketToken(@CurrentUser() user: AuthenticatedUser) {
    const token = await this.authService.createSocketToken(
      user.sub,
      user.email,
      user.role as UserRole,
      user.sid
    );
    return { token };
  }

  private async describeSession(payload: TokenPayload) {
    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      select: { id: true, role: true, emailVerifiedAt: true, deletedAt: true }
    });
    if (!user || user.deletedAt) return { authenticated: false as const };

    return {
      authenticated: true as const,
      userId: user.id,
      role: user.role,
      emailVerified: user.emailVerifiedAt !== null
    };
  }

  private async verifyToken(token: string, secretKey: string): Promise<TokenPayload | null> {
    try {
      return await this.jwtService.verifyAsync<TokenPayload>(token, {
        secret: this.configService.getOrThrow<string>(secretKey)
      });
    } catch {
      return null;
    }
  }

  private async hasValidAccessToken(token: string): Promise<boolean> {
    const payload = await this.verifyToken(token, 'JWT_SECRET');
    if (!payload || (payload.typ ?? 'access') !== 'access') return false;
    if (!payload.sid) return true;

    const session = await this.prisma.session.findUnique({
      where: { id: payload.sid },
      select: { revokedAt: true }
    });
    return !session || session.revokedAt === null;
  }

  private context(req: Request): RequestContext {
    return { ip: req.ip, userAgent: req.headers['user-agent'] };
  }

  private setAuthCookies(res: Response, tokens: { accessToken: string; refreshToken: string }) {
    res.cookie('accessToken', tokens.accessToken, {
      ...authCookieOptions(),
      maxAge: 15 * 60 * 1000 // 15 minutes
    });
    res.cookie('refreshToken', tokens.refreshToken, {
      ...authCookieOptions(),
      maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
    });
  }

  private clearAuthCookies(res: Response) {
    // clearCookie only matches a cookie whose attributes agree, so these options
    // must stay in step with the ones used to set them.
    res.clearCookie('accessToken', authCookieOptions());
    res.clearCookie('refreshToken', authCookieOptions());
  }
}
