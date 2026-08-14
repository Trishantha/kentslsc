import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Permission, UserRole, type TokenPayload } from '@kentslsc/shared';
import { PERMISSIONS_KEY } from '../decorators/require-permission.decorator.js';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator.js';

@Injectable()
export class PermissionGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass()
    ]);
    if (isPublic) return true;

    const requiredPermissions = this.reflector.getAllAndOverride<Permission[]>(PERMISSIONS_KEY, [
      context.getHandler(),
      context.getClass()
    ]);
    if (!requiredPermissions || requiredPermissions.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest<{ user?: TokenPayload & { permissions?: Permission[] } }>();
    const user = request.user;
    if (!user) {
      throw new ForbiddenException('Authentication required');
    }

    // ADMIN bypasses all permission checks.
    if (user.role === UserRole.ADMIN) {
      return true;
    }

    const userPermissions = new Set(user.permissions ?? []);
    const hasPermission = requiredPermissions.some((p) => userPermissions.has(p));
    if (!hasPermission) {
      throw new ForbiddenException('You do not have permission to perform this action');
    }

    return true;
  }
}
