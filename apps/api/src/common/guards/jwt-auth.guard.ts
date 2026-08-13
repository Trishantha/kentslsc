import { ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Reflector } from '@nestjs/core';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator.js';
import type { TokenPayload } from '@kentslsc/shared';

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
    if (isPublic) {
      // Public routes stay reachable without a session, but we still try to
      // authenticate so @OptionalAuth() can link actions to the signed-in user
      // when a token is present (e.g. guest donations, public "who am I" probes).
      try {
        return (await super.canActivate(context)) as boolean;
      } catch {
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
