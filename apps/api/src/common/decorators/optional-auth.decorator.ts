import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { TokenPayload } from '@kentslsc/shared';

/** Returns the authenticated user or null when the route is marked @Public(). */
export const OptionalAuth = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): TokenPayload | null => {
    const request = ctx.switchToHttp().getRequest();
    return (request.user as TokenPayload) ?? null;
  }
);
