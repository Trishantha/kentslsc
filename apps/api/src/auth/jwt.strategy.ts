import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import type { Request } from 'express';
import { TokenPayload } from '@kentslsc/shared';
import { accessTokenCookieName } from './auth-cookies.js';
import { TokenValidationService } from './token-validation.service.js';
import type { AuthenticatedUser } from '../common/types/authenticated-user.js';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    configService: ConfigService,
    private readonly tokenValidation: TokenValidationService
  ) {
    const cookieExtractor = (req: Request) => req?.cookies?.[accessTokenCookieName()] ?? null;

    super({
      jwtFromRequest: ExtractJwt.fromExtractors([
        cookieExtractor,
        ExtractJwt.fromAuthHeaderAsBearerToken()
      ]),
      ignoreExpiration: false,
      secretOrKey: configService.getOrThrow<string>('JWT_SECRET')
    });
  }

  // Requiring typ === 'access' is what stops the JS-readable socket token
  // (same secret, same shape) from being replayed as a bearer credential.
  async validate(payload: TokenPayload): Promise<AuthenticatedUser> {
    return this.tokenValidation.validate(payload, 'access');
  }
}
