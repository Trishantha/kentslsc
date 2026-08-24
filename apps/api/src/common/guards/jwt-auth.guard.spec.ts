import { jest, describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import type { Type } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtAuthGuard } from './jwt-auth.guard.js';

function createMockExecutionContext(request: Record<string, unknown>) {
  return {
    switchToHttp: () => ({
      getRequest: () => request,
      getResponse: jest.fn(),
      getNext: jest.fn()
    }),
    getHandler: () => function publicHandler() {},
    getClass: () => class TestController {}
  } as any;
}

describe('JwtAuthGuard', () => {
  let guard: JwtAuthGuard;
  let reflector: Reflector;
  let parentCanActivate: ReturnType<typeof jest.spyOn>;

  beforeEach(() => {
    reflector = new Reflector();
    guard = new JwtAuthGuard(reflector);
    const parentProto = Object.getPrototypeOf(JwtAuthGuard.prototype);
    parentCanActivate = jest
      .spyOn(parentProto, 'canActivate')
      .mockResolvedValue(true);
  });

  afterEach(() => {
    parentCanActivate.mockRestore();
  });

  function setMetadata(publicRoute: boolean, optionalAuth: boolean) {
    jest.spyOn(reflector, 'getAllAndOverride').mockImplementation(
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      (key: unknown, _targets: Array<(new (...args: unknown[]) => unknown) | Type<any>>) => {
        if (key === 'isPublic') return publicRoute;
        if (key === 'isOptionalAuth') return optionalAuth;
        return undefined;
      }
    );
  }

  describe('public routes', () => {
    it('skips authentication entirely when the route is public and not optionally authenticated', async () => {
      setMetadata(true, false);
      const ctx = createMockExecutionContext({ headers: {}, cookies: {} });

      const result = await guard.canActivate(ctx);

      expect(result).toBe(true);
      expect(parentCanActivate).not.toHaveBeenCalled();
    });

    it('allows anonymous requests on optionally authenticated public routes', async () => {
      setMetadata(true, true);
      const ctx = createMockExecutionContext({ headers: {}, cookies: {} });

      const result = await guard.canActivate(ctx);

      expect(result).toBe(true);
      expect(parentCanActivate).not.toHaveBeenCalled();
    });

    it('delegates to passport when an optional-auth route carries an Authorization header', async () => {
      setMetadata(true, true);
      const ctx = createMockExecutionContext({
        headers: { authorization: 'Bearer valid-token' },
        cookies: {}
      });

      const result = await guard.canActivate(ctx);

      expect(result).toBe(true);
      expect(parentCanActivate).toHaveBeenCalledWith(ctx);
    });

    it('delegates to passport when an optional-auth route carries an access-token cookie', async () => {
      setMetadata(true, true);
      const ctx = createMockExecutionContext({
        headers: {},
        cookies: { accessToken: 'valid-token' }
      });

      const result = await guard.canActivate(ctx);

      expect(result).toBe(true);
      expect(parentCanActivate).toHaveBeenCalledWith(ctx);
    });

    it('does not delegate to passport for a plain public route even when credentials are present', async () => {
      setMetadata(true, false);
      const ctx = createMockExecutionContext({
        headers: { authorization: 'Bearer valid-token' },
        cookies: {}
      });

      const result = await guard.canActivate(ctx);

      expect(result).toBe(true);
      expect(parentCanActivate).not.toHaveBeenCalled();
    });
  });

  describe('protected routes', () => {
    it('delegates to passport for protected routes', async () => {
      setMetadata(false, false);
      const ctx = createMockExecutionContext({ headers: {}, cookies: {} });

      const result = await guard.canActivate(ctx);

      expect(result).toBe(true);
      expect(parentCanActivate).toHaveBeenCalledWith(ctx);
    });

    it('delegates to passport even when no credentials are present', async () => {
      setMetadata(false, false);
      const ctx = createMockExecutionContext({ headers: {}, cookies: {} });
      parentCanActivate.mockRejectedValue(new Error('Unauthorized'));

      await expect(guard.canActivate(ctx)).rejects.toThrow('Unauthorized');
      expect(parentCanActivate).toHaveBeenCalledWith(ctx);
    });
  });
});
