import { Reflector } from '@nestjs/core';
import { Permission, UserRole } from '@kentslsc/shared';
import { PermissionGuard } from './permission.guard.js';
import { PERMISSIONS_KEY } from '../decorators/require-permission.decorator.js';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator.js';

describe('PermissionGuard', () => {
  let guard: PermissionGuard;
  let metadataMap: Map<unknown, Record<string | symbol, unknown>>;

  function createContext(user?: { role: UserRole; permissions?: Permission[] }) {
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
      },
      set: (key: string | symbol, value: unknown, target: unknown) => {
        const meta = metadataMap.get(target) ?? {};
        meta[key] = value;
        metadataMap.set(target, meta);
      }
    } as unknown as Reflector;

    guard = new PermissionGuard(reflector);
  });

  it('allows public routes', () => {
    const ctx = createContext();
    metadataMap.set(ctx.getHandler(), { [IS_PUBLIC_KEY]: true });
    expect(guard.canActivate(ctx)).toBe(true);
  });

  it('allows routes with no required permissions', () => {
    expect(guard.canActivate(createContext({ role: UserRole.MEMBER }))).toBe(true);
  });

  it('denies unauthenticated users when permissions are required', () => {
    const ctx = createContext();
    metadataMap.set(ctx.getHandler(), { [PERMISSIONS_KEY]: [Permission.MANAGE_EVENTS] });
    expect(() => guard.canActivate(ctx)).toThrow('Authentication required');
  });

  it('allows admins regardless of permissions', () => {
    const ctx = createContext({ role: UserRole.ADMIN, permissions: [] });
    metadataMap.set(ctx.getHandler(), { [PERMISSIONS_KEY]: [Permission.MANAGE_USERS] });
    expect(guard.canActivate(ctx)).toBe(true);
  });

  it('allows users with the required permission', () => {
    const ctx = createContext({ role: UserRole.MEMBER, permissions: [Permission.MANAGE_EVENTS] });
    metadataMap.set(ctx.getHandler(), { [PERMISSIONS_KEY]: [Permission.MANAGE_EVENTS] });
    expect(guard.canActivate(ctx)).toBe(true);
  });

  it('denies users without the required permission', () => {
    const ctx = createContext({ role: UserRole.MEMBER, permissions: [Permission.MANAGE_EVENTS] });
    metadataMap.set(ctx.getHandler(), { [PERMISSIONS_KEY]: [Permission.MANAGE_USERS] });
    expect(() => guard.canActivate(ctx)).toThrow('You do not have permission');
  });

  it('allows when any of the listed permissions is held', () => {
    const ctx = createContext({ role: UserRole.MEMBER, permissions: [Permission.MANAGE_EVENTS] });
    metadataMap.set(ctx.getHandler(), { [PERMISSIONS_KEY]: [Permission.MANAGE_USERS, Permission.MANAGE_EVENTS] });
    expect(guard.canActivate(ctx)).toBe(true);
  });
});
