import { Injectable, UnauthorizedException, ConflictException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import { createHash } from 'crypto';
import { PrismaService } from '../core/prisma/prisma.service.js';
import { Prisma } from '@kentslsc/database';
import { RedisService } from '../core/redis/redis.service.js';
import { MembershipsService } from '../memberships/memberships.service.js';
import { MembershipFeaturesService } from '../memberships/membership-features.service.js';
import { LoginInput, UserRole, TokenPayload, MembershipFeature } from '@kentslsc/shared';
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
    private readonly redis: RedisService,
    private readonly membershipsService: MembershipsService,
    private readonly featuresService: MembershipFeaturesService
  ) {}

  async register(data: RegisterDto) {
    const existing = await this.prisma.user.findUnique({ where: { email: data.email } });
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
        email: data.email,
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

    const tokens = await this.buildTokens(user.id, user.email, user.role as UserRole);

    return {
      user: {
        id: user.id,
        name: user.name,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        role: user.role
      },
      ...tokens,
      application: applicationResult
    };
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
    return this.buildTokens(user.id, user.email, user.role as UserRole);
  }

  async refresh(refreshToken: string): Promise<AuthTokens> {
    try {
      const payload = await this.jwtService.verifyAsync(refreshToken, {
        secret: this.configService.getOrThrow<string>('JWT_REFRESH_SECRET')
      });
      const refreshHash = this.hashToken(refreshToken);
      const user = await this.prisma.user.findUnique({
        where: { id: payload.sub, refreshToken: refreshHash }
      });
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

  async getUserFeatures(userId: string): Promise<MembershipFeature[]> {
    return this.featuresService.userActiveFeatures(userId);
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
    const refreshHash = this.hashToken(refreshToken);
    const refreshTtl = 7 * 24 * 60 * 60;
    await Promise.all([
      this.prisma.user.update({ where: { id: userId }, data: { refreshToken: refreshHash } }),
      this.redis.set(`refresh:${userId}`, refreshHash, refreshTtl)
    ]);
    return { accessToken, refreshToken };
  }

  private hashToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }
}
