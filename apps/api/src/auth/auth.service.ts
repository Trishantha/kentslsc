import { Injectable, UnauthorizedException, ConflictException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../core/prisma/prisma.service.js';
import { RedisService } from '../core/redis/redis.service.js';
import { LoginInput, UserRole, TokenPayload } from '@kentslsc/shared';
import { RegisterDto } from './dto/register.dto.js';

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly redis: RedisService
  ) {}

  async register(data: RegisterDto) {
    const existing = await this.prisma.user.findUnique({ where: { email: data.email } });
    if (existing) {
      throw new ConflictException('Email already registered');
    }
    const passwordHash = await bcrypt.hash(data.password, 12);
    const user = await this.prisma.user.create({
      data: {
        name: data.name,
        email: data.email,
        phone: data.phone,
        address: data.address,
        passwordHash,
        role: (data.role as UserRole) ?? UserRole.GUEST
      }
    });
    return this.buildTokens(user.id, user.email, user.role as UserRole);
  }

  async login(data: LoginInput): Promise<AuthTokens> {
    const user = await this.prisma.user.findUnique({ where: { email: data.email } });
    if (!user || user.deletedAt) {
      throw new UnauthorizedException('Invalid credentials');
    }
    const valid = await bcrypt.compare(data.password, user.passwordHash);
    if (!valid) {
      throw new UnauthorizedException('Invalid credentials');
    }
    const tokens = await this.buildTokens(user.id, user.email, user.role as UserRole);
    await this.prisma.user.update({ where: { id: user.id }, data: { refreshToken: tokens.refreshToken } });
    return tokens;
  }

  async refresh(refreshToken: string): Promise<AuthTokens> {
    try {
      const payload = await this.jwtService.verifyAsync(refreshToken, {
        secret: this.configService.getOrThrow<string>('JWT_REFRESH_SECRET')
      });
      const user = await this.prisma.user.findUnique({ where: { id: payload.sub, refreshToken } });
      if (!user || user.deletedAt) {
        throw new UnauthorizedException('Invalid refresh token');
      }
      return this.buildTokens(user.id, user.email, user.role as UserRole);
    } catch {
      throw new UnauthorizedException('Invalid refresh token');
    }
  }

  async logout(userId: string) {
    await this.prisma.user.update({ where: { id: userId }, data: { refreshToken: null } });
    await this.redis.del(`refresh:${userId}`);
  }

  async createSocketToken(userId: string, email: string, role: UserRole): Promise<string> {
    const payload: Omit<TokenPayload, 'iat' | 'exp'> = { sub: userId, email, role };
    return this.jwtService.signAsync(payload, {
      secret: this.configService.getOrThrow<string>('JWT_SECRET'),
      expiresIn: '5m'
    });
  }

  async buildTokens(userId: string, email: string, role: UserRole): Promise<AuthTokens> {
    const payload: Omit<TokenPayload, 'iat' | 'exp'> = { sub: userId, email, role };
    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync(payload, {
        secret: this.configService.getOrThrow<string>('JWT_SECRET'),
        expiresIn: this.configService.get<string>('JWT_ACCESS_EXPIRY') ?? '15m'
      }),
      this.jwtService.signAsync(payload, {
        secret: this.configService.getOrThrow<string>('JWT_REFRESH_SECRET'),
        expiresIn: this.configService.get<string>('JWT_REFRESH_EXPIRY') ?? '7d'
      })
    ]);
    await this.redis.set(`refresh:${userId}`, refreshToken, 7 * 24 * 60 * 60);
    return { accessToken, refreshToken };
  }
}
