import { ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { CsrfGuard } from './csrf.guard.js';
import { CsrfService } from './csrf.service.js';
import { IS_PUBLIC_KEY } from '../common/decorators/public.decorator.js';

describe('CsrfGuard', () => {
  let guard: CsrfGuard;
  let csrfService: CsrfService;
  let metadataMap: Map<unknown, Record<string | symbol, unknown>>;

  function createContext(method: string, cookie?: string, header?: string) {
    const handler = {};
    const targetClass = {};
    return {
      switchToHttp: () => ({
        getRequest: () => ({
          method,
          cookies: cookie ? { csrfToken: cookie } : {},
          headers: header ? { 'x-csrf-token': header } : {}
        })
      }),
      getHandler: () => handler,
      getClass: () => targetClass
    } as unknown as import('@nestjs/common').ExecutionContext;
  }

  beforeEach(() => {
    metadataMap = new Map();
    csrfService = new CsrfService();

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

    guard = new CsrfGuard(reflector, csrfService);
  });

  it('allows safe methods without a token', () => {
    for (const method of ['GET', 'HEAD', 'OPTIONS']) {
      expect(guard.canActivate(createContext(method))).toBe(true);
    }
  });

  it('allows public routes without a token', () => {
    const ctx = createContext('POST');
    metadataMap.set(ctx.getHandler(), { [IS_PUBLIC_KEY]: true });
    expect(guard.canActivate(ctx)).toBe(true);
  });

  it('allows state-changing requests with a matching token', () => {
    const ctx = createContext('POST', 'token-value', 'token-value');
    expect(guard.canActivate(ctx)).toBe(true);
  });

  it('rejects state-changing requests without a cookie', () => {
    const ctx = createContext('POST', undefined, 'token-value');
    expect(() => guard.canActivate(ctx)).toThrow(ForbiddenException);
  });

  it('rejects state-changing requests without a header', () => {
    const ctx = createContext('POST', 'token-value', undefined);
    expect(() => guard.canActivate(ctx)).toThrow(ForbiddenException);
  });

  it('rejects state-changing requests with a mismatched token', () => {
    const ctx = createContext('POST', 'token-value', 'different-value');
    expect(() => guard.canActivate(ctx)).toThrow('CSRF token missing or invalid');
  });

  it('rejects PUT, PATCH, DELETE methods without a token', () => {
    for (const method of ['PUT', 'PATCH', 'DELETE']) {
      const ctx = createContext(method);
      expect(() => guard.canActivate(ctx)).toThrow(ForbiddenException);
    }
  });
});
