import { Reflector } from '@nestjs/core';
import { ForbiddenException } from '@nestjs/common';
import { UserRole, type TokenPayload } from '@kentslsc/shared';
import { RolesGuard } from './roles.guard.js';
import { ROLES_KEY } from '../decorators/roles.decorator.js';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator.js';

describe('RolesGuard', () => {
  let guard: RolesGuard;
  let metadataMap: Map<unknown, Record<string | symbol, unknown>>;

  function createContext(user?: TokenPayload) {
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

    guard = new RolesGuard(reflector);
  });

  it('allows public routes', () => {
    const ctx = createContext();
    metadataMap.set(ctx.getHandler(), { [IS_PUBLIC_KEY]: true });
    expect(guard.canActivate(ctx)).toBe(true);
  });

  it('allows routes with no required roles', () => {
    expect(guard.canActivate(createContext({ sub: 'u1', email: 'a@b.c', role: UserRole.MEMBER, sid: 's1' }))).toBe(true);
  });

  it('allows users with a required role', () => {
    const ctx = createContext({ sub: 'u1', email: 'a@b.c', role: UserRole.ADMIN, sid: 's1' });
    metadataMap.set(ctx.getHandler(), { [ROLES_KEY]: [UserRole.ADMIN] });
    expect(guard.canActivate(ctx)).toBe(true);
  });

  it('denies users without the required role', () => {
    const ctx = createContext({ sub: 'u1', email: 'a@b.c', role: UserRole.MEMBER, sid: 's1' });
    metadataMap.set(ctx.getHandler(), { [ROLES_KEY]: [UserRole.ADMIN] });
    expect(guard.canActivate(ctx)).toBe(false);
  });

  it('denies unauthenticated users when roles are required', () => {
    const ctx = createContext();
    metadataMap.set(ctx.getHandler(), { [ROLES_KEY]: [UserRole.ADMIN] });
    expect(() => guard.canActivate(ctx)).toThrow('Insufficient permissions');
  });
});
