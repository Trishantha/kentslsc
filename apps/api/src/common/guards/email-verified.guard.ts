import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator.js';
import { ALLOW_UNVERIFIED_KEY } from '../decorators/allow-unverified.decorator.js';
import type { AuthenticatedUser } from '../types/authenticated-user.js';

/**
 * Blocks signed-in but unverified users from the portal.
 *
 * Registered globally after JwtAuthGuard, so by the time it runs the request is
 * either public or carries an authenticated user.
 */
@Injectable()
export class EmailVerifiedGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass()
    ]);
    if (isPublic) return true;

    const allowUnverified = this.reflector.getAllAndOverride<boolean>(ALLOW_UNVERIFIED_KEY, [
      context.getHandler(),
      context.getClass()
    ]);
    if (allowUnverified) return true;

    const request = context.switchToHttp().getRequest<{ user?: AuthenticatedUser }>();
    const user = request.user;

    // No user means JwtAuthGuard already let this through as public; not this
    // guard's decision to second-guess.
    if (!user) return true;

    if (!user.emailVerified) {
      // A distinct code so the web client can route to /verify-email rather than
      // showing a generic "forbidden".
      throw new ForbiddenException({
        code: 'EMAIL_NOT_VERIFIED',
        message: 'Confirm your email address to access this area.'
      });
    }

    return true;
  }
}
