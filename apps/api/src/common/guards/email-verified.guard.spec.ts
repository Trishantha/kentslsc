import { Reflector } from '@nestjs/core';
import { ForbiddenException } from '@nestjs/common';
import { UserRole } from '@kentslsc/shared';
import { EmailVerifiedGuard } from './email-verified.guard.js';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator.js';
import { ALLOW_UNVERIFIED_KEY } from '../decorators/allow-unverified.decorator.js';
import type { AuthenticatedUser } from '../types/authenticated-user.js';

describe('EmailVerifiedGuard', () => {
  let guard: EmailVerifiedGuard;
  let metadataMap: Map<unknown, Record<string | symbol, unknown>>;

  function createContext(user?: AuthenticatedUser) {
    const handler = {};
    const targetClass = {};
    return {
      switchToHttp: () => ({
        getRequest: () => ({ user })
      }),
      getHandler: () => handler,
      getClass: () => targetClass
    } as unknown as import('@nestjs/common').ExecutionContext;
  }

  function setMetadata(ctx: import('@nestjs/common').ExecutionContext, key: string | symbol, value: unknown) {
    metadataMap.set(ctx.getHandler(), { [key]: value });
  }

  beforeEach(() => {
    metadataMap = new Map();

    const reflector = {
      getAllAndOverride: <T>(key: string | symbol, targets: unknown[]) => {
        for (const target of targets) {
          const meta = metadataMap.get(target);
          if (meta && key in meta) {
            return meta[key] as T;
          }
        }
        return undefined;
      }
    } as unknown as Reflector;

    guard = new EmailVerifiedGuard(reflector);
  });

  it('allows public routes', () => {
    const ctx = createContext();
    setMetadata(ctx, IS_PUBLIC_KEY, true);
    expect(guard.canActivate(ctx)).toBe(true);
  });

  it('allows unauthenticated requests through (decision belongs to JwtAuthGuard)', () => {
    const ctx = createContext(undefined);
    expect(guard.canActivate(ctx)).toBe(true);
  });

  it('allows verified users', () => {
    const ctx = createContext({ sub: 'u1', email: 'a@b.c', role: UserRole.MEMBER, emailVerified: true, sid: 's1', permissions: [] });
    expect(guard.canActivate(ctx)).toBe(true);
  });

  it('allows unverified users on routes marked @AllowUnverified', () => {
    const ctx = createContext({ sub: 'u1', email: 'a@b.c', role: UserRole.MEMBER, emailVerified: false, sid: 's1', permissions: [] });
    setMetadata(ctx, ALLOW_UNVERIFIED_KEY, true);
    expect(guard.canActivate(ctx)).toBe(true);
  });

  it('blocks unverified users on protected routes', () => {
    const ctx = createContext({ sub: 'u1', email: 'a@b.c', role: UserRole.MEMBER, emailVerified: false, sid: 's1', permissions: [] });
    expect(() => guard.canActivate(ctx)).toThrow(ForbiddenException);
    try {
      guard.canActivate(ctx);
    } catch (err) {
      expect((err as ForbiddenException).getResponse()).toMatchObject({
        code: 'EMAIL_NOT_VERIFIED'
      });
    }
  });
});
