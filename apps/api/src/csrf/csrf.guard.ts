import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { CsrfService } from './csrf.service.js';
import { IS_PUBLIC_KEY } from '../common/decorators/public.decorator.js';

@Injectable()
export class CsrfGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly csrfService: CsrfService
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();
    const method = request.method.toUpperCase();

    // Safe methods are not state-changing and therefore not CSRF vectors.
    if (['GET', 'HEAD', 'OPTIONS'].includes(method)) {
      return true;
    }

    // Public routes are already unauthenticated; applying CSRF here would break
    // login/register/password-reset entry points and webhook receivers. They are
    // protected by other means (throttling, signatures, CORS).
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass()
    ]);
    if (isPublic) {
      return true;
    }

    const cookie = request.cookies?.[this.csrfService.getCookieName()];
    const header = request.headers[this.csrfService.getHeaderName()] as string | undefined;

    if (!cookie || !header || cookie !== header) {
      throw new ForbiddenException('CSRF token missing or invalid');
    }

    return true;
  }
}
