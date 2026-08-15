import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { Permission, UserRole, type TokenPayload, type TokenType, UserStatus } from '@kentslsc/shared';
import { PrismaService } from '../core/prisma/prisma.service.js';
import { PermissionsService } from '../permissions/permissions.service.js';
import type { AuthenticatedUser } from '../common/types/authenticated-user.js';

/**
 * The single choke point for turning a verified JWT payload into a trusted
 * caller. Both JwtStrategy (HTTP) and ForumGateway (websockets) go through here
 * so neither can drift out of step with the revocation rules.
 */
@Injectable()
export class TokenValidationService {
  private readonly logger = new Logger(TokenValidationService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly permissionsService: PermissionsService
  ) {}

  async validate(payload: TokenPayload, expectedType: TokenType): Promise<AuthenticatedUser> {
    // Tokens minted for a different purpose must not be interchangeable.
    // Legacy tokens issued before `typ` existed have no claim; treat those as
    // access tokens so sessions created before this deploy still work until
    // they expire, but never let them satisfy a ws/refresh check.
    const actualType = payload.typ ?? 'access';
    if (actualType !== expectedType) {
      throw new UnauthorizedException('Invalid token type');
    }

    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      select: {
        id: true,
        email: true,
        role: true,
        deletedAt: true,
        emailVerifiedAt: true,
        status: true
      }
    });

    if (!user || user.deletedAt) {
      throw new UnauthorizedException('User not found');
    }

    if (user.status === UserStatus.BANNED) {
      throw new UnauthorizedException('User account has been suspended');
    }

    if (payload.sid) {
      const session = await this.prisma.session.findUnique({
        where: { id: payload.sid },
        select: { userId: true, revokedAt: true, expiresAt: true }
      });
      if (!session || session.userId !== payload.sub || session.revokedAt || session.expiresAt <= new Date()) {
        throw new UnauthorizedException('Session has been revoked');
      }
    }

    // Load effective permissions from the database so permission changes apply
    // immediately without requiring a token refresh.
    const permissions = await this.permissionsService.getUserPermissions(user.id);

    return {
      sub: user.id,
      email: user.email,
      // Read from the row, not the token, so a role change takes effect on the
      // very next request rather than after the access token expires.
      role: user.role as UserRole,
      sid: payload.sid ?? '',
      typ: actualType,
      jti: payload.jti,
      emailVerified: user.emailVerifiedAt !== null,
      permissions: permissions as Permission[]
    };
  }
}
