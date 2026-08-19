import { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ThrottlerStorage } from '@nestjs/throttler';
import { AppThrottlerGuard } from './throttler.guard.js';

class MockExecutionContext implements Partial<ExecutionContext> {
  constructor(private readonly req: Record<string, unknown>) {}

  getType() {
    return 'http' as const;
  }

  switchToHttp() {
    return {
      getRequest: () => this.req,
      getResponse: () => ({ statusCode: 200 })
    };
  }

  getHandler() {
    return () => {};
  }

  getClass() {
    return {} as any;
  }
}

describe('AppThrottlerGuard', () => {
  const reflector = new Reflector();
  const storage = { increment: jest.fn() } as unknown as ThrottlerStorage;
  const guard = new AppThrottlerGuard(
    { throttlers: [{ name: 'default', limit: 10, ttl: 60_000 }] } as any,
    storage,
    reflector
  );

  // shouldSkip is protected; access it through a type cast for unit testing.
  const shouldSkip = (context: ExecutionContext) => (guard as any).shouldSkip(context) as Promise<boolean>;

  it('skips throttling for 127.0.0.1', async () => {
    const context = new MockExecutionContext({ ip: '127.0.0.1' }) as ExecutionContext;
    await expect(shouldSkip(context)).resolves.toBe(true);
  });

  it('skips throttling for IPv6 loopback', async () => {
    const context = new MockExecutionContext({ ip: '::1' }) as ExecutionContext;
    await expect(shouldSkip(context)).resolves.toBe(true);
  });

  it('skips throttling for IPv4-mapped IPv6 loopback', async () => {
    const context = new MockExecutionContext({ ip: '::ffff:127.0.0.1' }) as ExecutionContext;
    await expect(shouldSkip(context)).resolves.toBe(true);
  });

  it('does not skip throttling for public IPs', async () => {
    const context = new MockExecutionContext({ ip: '203.0.113.45' }) as ExecutionContext;
    await expect(shouldSkip(context)).resolves.toBe(false);
  });

  it('does not skip throttling when IP is missing', async () => {
    const context = new MockExecutionContext({}) as ExecutionContext;
    await expect(shouldSkip(context)).resolves.toBe(false);
  });
});
