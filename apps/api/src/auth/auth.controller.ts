import { Body, Controller, Get, HttpCode, HttpStatus, Post, Req, Res, UnauthorizedException, UseGuards } from '@nestjs/common';
import type { Request, Response } from 'express';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { AuthService } from './auth.service.js';
import { RegisterDto } from './dto/register.dto.js';
import { LoginDto } from './dto/login.dto.js';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard.js';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import { UserRole, type TokenPayload } from '@kentslsc/shared';
import { PrismaService } from '../core/prisma/prisma.service.js';

@ApiTags('Auth')
@Controller('auth')
@Throttle({ default: { limit: 5, ttl: 15 } })
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly prisma: PrismaService
  ) {}

  @Post('register')
  async register(@Body() dto: RegisterDto, @Res({ passthrough: true }) res: Response) {
    const result = await this.authService.register(dto);
    this.setAuthCookies(res, { accessToken: result.accessToken, refreshToken: result.refreshToken });
    return { success: true, user: result.user, application: result.application };
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(@Body() dto: LoginDto, @Res({ passthrough: true }) res: Response) {
    const tokens = await this.authService.login(dto);
    this.setAuthCookies(res, tokens);
    return { success: true };
  }

  @Post('refresh')
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
    const tokens = await this.authService.refresh(refreshToken);
    this.setAuthCookies(res, tokens);
    return { success: true };
  }

  @Post('logout')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  async logout(@CurrentUser() user: TokenPayload, @Res({ passthrough: true }) res: Response) {
    await this.authService.logout(user.sub);
    res.clearCookie('accessToken');
    res.clearCookie('refreshToken');
    return { success: true };
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  async me(@CurrentUser() user: TokenPayload) {
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
        createdAt: true
      }
    });
    return profile;
  }

  @Get('features')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  async features(@CurrentUser() user: TokenPayload) {
    return this.authService.getUserFeatures(user.sub);
  }

  @Get('socket-token')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  async socketToken(@CurrentUser() user: TokenPayload) {
    const token = await this.authService.createSocketToken(user.sub, user.email, user.role as UserRole);
    return { token };
  }

  private setAuthCookies(res: Response, tokens: { accessToken: string; refreshToken: string }) {
    const isProduction = process.env.NODE_ENV === 'production';
    res.cookie('accessToken', tokens.accessToken, {
      httpOnly: true,
      secure: isProduction,
      sameSite: 'strict',
      path: '/',
      maxAge: 15 * 60 * 1000 // 15 minutes
    });
    res.cookie('refreshToken', tokens.refreshToken, {
      httpOnly: true,
      secure: isProduction,
      sameSite: 'strict',
      path: '/',
      maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
    });
  }
}
