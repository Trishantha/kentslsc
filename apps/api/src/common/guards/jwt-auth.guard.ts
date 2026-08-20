import { ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { accessTokenCookieName } from '@kentslsc/shared';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator.js';
import { IS_OPTIONAL_AUTH_KEY } from '../decorators/optional-auth-route.decorator.js';
import type { TokenPayload } from '@kentslsc/shared';

function hasAuthCredential(request: Request): boolean {
  const authHeader = request.headers.authorization;
  if (authHeader && authHeader.toLowerCase().startsWith('bearer ')) {
    return true;
  }

  const cookies = request.cookies ?? {};
  const isProduction = process.env.NODE_ENV === 'production';
  if (cookies[accessTokenCookieName(isProduction)]) {
    return true;
  }
  // Fallback to the non-prefixed name so a production instance that receives a
  // dev-format cookie (e.g. during a rollout transition) still attempts validation.
  if (isProduction && cookies['accessToken']) {
    return true;
  }

  return false;
}

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  constructor(private reflector: Reflector) {
    super();
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass()
    ]);
    const isOptionalAuth = this.reflector.getAllAndOverride<boolean>(IS_OPTIONAL_AUTH_KEY, [
      context.getHandler(),
      context.getClass()
    ]);

    if (isPublic) {
      if (!isOptionalAuth) {
        // Fully public route: no authentication is attempted. This keeps the
        // behaviour deny-by-default while avoiding unnecessary JWT work on
        // public content and webhook endpoints.
        return true;
      }

      // Optional-auth route: anonymous requests are allowed, but if the client
      // sends credentials we validate them strictly. This prevents a public
      // route from silently accepting an expired or forged token.
      const request = context.switchToHttp().getRequest<Request>();
      if (!hasAuthCredential(request)) {
        return true;
      }
    }

    return super.canActivate(context) as boolean;
  }

  handleRequest<TUser = TokenPayload>(err: unknown, user: unknown): TUser {
    if (err || !user) {
      throw err || new UnauthorizedException('Invalid or missing token');
    }
    return user as TUser;
  }
}
