import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { TokenPayload } from '@kentslsc/shared';

/**
 * Returns the authenticated user or null.
 *
 * Must be paired with @OptionalAuthRoute() on the route so the guard knows it
 * may attempt authentication without rejecting anonymous requests. On a plain
 * @Public() route the request.user is never populated, so this will always be null.
 */
export const OptionalAuth = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): TokenPayload | null => {
    const request = ctx.switchToHttp().getRequest();
    return (request.user as TokenPayload) ?? null;
  }
);
